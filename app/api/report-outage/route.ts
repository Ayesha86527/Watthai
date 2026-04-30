import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';

const ADJACENCY: Record<string, string[]> = {
  'defence':          ['clifton', 'pechs'],
  'clifton':          ['defence', 'pechs'],
  'gulistan-e-johar': ['gulshan-e-iqbal', 'korangi'],
  'nazimabad':        ['gulshan-e-iqbal', 'north-karachi'],
  'gulshan-e-iqbal':  ['gulistan-e-johar', 'nazimabad'],
  'pechs':            ['defence', 'clifton'],
  'north-karachi':    ['nazimabad', 'surjani'],
  'korangi':          ['gulistan-e-johar', 'malir'],
  'surjani':          ['north-karachi', 'orangi'],
  'malir':            ['korangi', 'lyari'],
  'lyari':            ['malir', 'orangi'],
  'orangi':           ['lyari', 'surjani'],
};

export async function POST(req: Request) {
  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(
      authHeader.replace('Bearer ', '')
    );
    userId = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Parse body
  let zoneId: string;
  let photoUrl: string | null;
  try {
    const body = await req.json();
    if (!body.zone_id) throw new Error('zone_id is required');
    zoneId = body.zone_id;
    photoUrl = body.photo_url ?? null;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find existing active outage in this zone
    const activeSnap = await adminDb.collection('outages')
      .where('zone_id', '==', zoneId)
      .where('status', '==', 'active')
      .where('started_at', '>=', twoHoursAgo)
      .limit(1)
      .get();

    let outageId: string;
    let reportCount: number;

    if (!activeSnap.empty) {
      const outageDoc = activeSnap.docs[0];
      outageId = outageDoc.id;
      reportCount = (outageDoc.data().report_count ?? 0) + 1;

      await adminDb.collection('outages').doc(outageId).update({
        report_count: reportCount,
      });
    } else {
      const newRef = adminDb.collection('outages').doc();
      outageId = newRef.id;
      reportCount = 1;

      await newRef.set({
        zone_id:      zoneId,
        status:       'active',
        report_count: 1,
        fcm_sent:     false,
        started_at:   new Date().toISOString(),
      });
    }

    // Add report (ignore duplicate from same user — best effort)
    try {
      await adminDb.collection('outageReports').add({
        outage_id:  outageId,
        user_id:    userId,
        zone_id:    zoneId,
        photo_url:  photoUrl,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Duplicate report — ignore silently
    }

    // Threshold: 10 reports → mark for FCM (actual FCM send goes here when ready)
    let thresholdReached = false;
    if (reportCount >= 10) {
      thresholdReached = true;
      const outageRef = adminDb.collection('outages').doc(outageId);
      const latest = await outageRef.get();
      if (!latest.data()?.fcm_sent) {
        await outageRef.update({ fcm_sent: true });
        // TODO: send FCM multicast to zone users here
        console.log(`Threshold reached for zone ${zoneId} — FCM would fire here`);
      }
    }

    // Adjacent zone propagation at 20 reports
    if (reportCount >= 20) {
      const adjacentZones = ADJACENCY[zoneId] ?? [];
      console.log(`High report count — adjacent zones to notify: ${adjacentZones.join(', ')}`);
      // TODO: send FCM to adjacent zone users here
    }

    return NextResponse.json({ outage_id: outageId, report_count: reportCount, threshold_reached: thresholdReached });

  } catch (error: any) {
    console.error('report-outage error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}