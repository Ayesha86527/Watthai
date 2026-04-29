import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing Auth" }, { status: 401 });

    const decodedToken = await adminAuth.verifyIdToken(authHeader.replace("Bearer ", ""));
    if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { zone_id, photo_url } = await req.json();

    if (!zone_id) {
         return NextResponse.json({ error: "Missing zone_id" }, { status: 400 });
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const activeOutagesSnap = await adminDb.collection("outages")
      .where("zone_id", "==", zone_id)
      .where("status", "==", "active")
      .where("started_at", ">=", twoHoursAgo)
      .limit(1)
      .get();

    let outage_id;
    let report_count = 1;

    if (!activeOutagesSnap.empty) {
       const activeOutage = activeOutagesSnap.docs[0];
       outage_id = activeOutage.id;
       report_count = activeOutage.data().report_count + 1;
       await adminDb.collection("outages").doc(outage_id).update({ report_count });
    } else {
       const newOutageRef = adminDb.collection("outages").doc();
       outage_id = newOutageRef.id;
       await newOutageRef.set({
           zone_id,
           status: "active",
           report_count: 1,
           started_at: new Date().toISOString()
       });
    }

    // Insert report
    await adminDb.collection("outageReports").add({
       outage_id,
       user_id: decodedToken.uid,
       zone_id,
       photo_url: photo_url || null,
       created_at: new Date().toISOString()
    });

    let threshold_reached = false;
    if (report_count >= 10 /* && no fcm sent logic here */) {
       threshold_reached = true;
       // We would send FCM logic using adminAuth here
    }

    return NextResponse.json({ outage_id, report_count, threshold_reached });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
