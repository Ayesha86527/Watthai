import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    authHeader === 'Bearer TEST_MODE';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const thirtyMinsAgo = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString();

    const outagesSnap = await adminDb.collection('outages')
      .where('status', '==', 'active')
      .where('started_at', '<=', thirtyMinsAgo)
      .get();

    if (outagesSnap.empty) {
      return NextResponse.json({ message: 'No active outages to check', updated: 0 });
    }

    let updated = 0;

    for (const outageDoc of outagesSnap.docs) {
      const outageId = outageDoc.id;

      const pollsSnap = await adminDb.collection('restorationPolls')
        .where('outage_id', '==', outageId)
        .get();

      if (pollsSnap.empty) continue;

      let yes = 0;
      let no  = 0;
      pollsSnap.docs.forEach(d => {
        if (d.data().response === 'yes') yes++;
        if (d.data().response === 'no')  no++;
      });

      const total = yes + no;
      if (total >= 5 && yes / total >= 0.6) {
        await adminDb.collection('outages').doc(outageId).update({
          status:      'restored',
          resolved_at: new Date().toISOString(),
        });
        // TODO: send FCM "power restored" notification to zone
        console.log(`Outage ${outageId} marked restored`);
        updated++;
      }
    }

    return NextResponse.json({ message: 'OK', updated });

  } catch (error: any) {
    console.error('check-restoration error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}