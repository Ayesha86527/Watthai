import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.replace('Bearer ', ''));
    userId = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  let zoneId: string;
  try {
    const body = await req.json();
    if (!body.zone_id) throw new Error('zone_id is required');
    zoneId = body.zone_id;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find active outage in this zone
    const activeSnap = await adminDb.collection('outages')
      .where('zone_id', '==', zoneId)
      .where('status', '==', 'active')
      .where('started_at', '>=', twoHoursAgo)
      .limit(1)
      .get();

    let outageId: string;
    let reportCount: number;
    let alreadyReported = false;

    if (!activeSnap.empty) {
      outageId = activeSnap.docs[0].id;
      reportCount = activeSnap.docs[0].data().report_count ?? 0;

      // ── Check if this user already reported this outage ──
      const existingReport = await adminDb.collection('outageReports')
        .where('outage_id', '==', outageId)
        .where('user_id', '==', userId)
        .limit(1)
        .get();

      if (!existingReport.empty) {
        alreadyReported = true;
      } else {
        // New report from this user — increment
        reportCount = reportCount + 1;
        await adminDb.collection('outages').doc(outageId).update({
          report_count: reportCount,
        });
        await adminDb.collection('outageReports').add({
          outage_id:  outageId,
          user_id:    userId,
          zone_id:    zoneId,
          photo_url:  null,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      // No active outage — create one
      const newRef = adminDb.collection('outages').doc();
      outageId    = newRef.id;
      reportCount = 1;

      await newRef.set({
        zone_id:      zoneId,
        status:       'active',
        report_count: 1,
        fcm_sent:     false,
        started_at:   new Date().toISOString(),
      });

      await adminDb.collection('outageReports').add({
        outage_id:  outageId,
        user_id:    userId,
        zone_id:    zoneId,
        photo_url:  null,
        created_at: new Date().toISOString(),
      });
    }

    // FCM threshold
    if (!alreadyReported && reportCount >= 10) {
      const outageRef = adminDb.collection('outages').doc(outageId);
      const latest    = await outageRef.get();
      if (!latest.data()?.fcm_sent) {
        await outageRef.update({ fcm_sent: true });
        console.log(`FCM threshold reached for zone ${zoneId}`);
      }
    }

    return NextResponse.json({
      outage_id:        outageId,
      report_count:     reportCount,
      already_reported: alreadyReported,
      threshold_reached: reportCount >= 10,
    });

  } catch (error: any) {
    console.error('report-outage error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}