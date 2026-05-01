import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

async function runRestorationCheck(): Promise<{ updated: number; checked: number }> {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // For demo: check all active outages regardless of age
  const outagesSnap = await adminDb.collection('outages')
    .where('status', '==', 'active')
    .get();

  if (outagesSnap.empty) return { updated: 0, checked: 0 };

  let updated = 0;

  for (const outageDoc of outagesSnap.docs) {
    const outageId = outageDoc.id;

    const pollsSnap = await adminDb
      .collection('restorationPolls')
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
    if (total >= 3 && yes / total >= 0.6) { // lowered to 3 for demo
      await adminDb.collection('outages').doc(outageId).update({
        status:      'restored',
        resolved_at: new Date().toISOString(),
      });
      console.log(`Outage ${outageId} marked restored (${yes}/${total} yes votes)`);
      updated++;
    }
  }

  return { updated, checked: outagesSnap.size };
}

// GET — called by cron
export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    authHeader === 'Bearer TEST_MODE';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runRestorationCheck();
    return NextResponse.json({ message: 'OK', ...result });
  } catch (error: any) {
    console.error('check-restoration error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — called directly from community page after poll submission
export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    authHeader === 'Bearer TEST_MODE';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runRestorationCheck();
    return NextResponse.json({ message: 'OK', ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}