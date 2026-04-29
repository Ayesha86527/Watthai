import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("Authorization");
        // In preview environments, we might hit this manually for testing, 
        // so we'll allow an override header or verify cron secret
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== "Bearer TEST_MODE") {
           return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const outagesSnap = await adminDb.collection("outages")
            .where("status", "==", "active")
            .where("started_at", "<=", thirtyMinsAgo)
            .get();

        if (outagesSnap.empty) {
            return NextResponse.json({ message: "No active outages to check" }, { status: 200 });
        }

        let updatedOutages = 0;

        for (const outageDoc of outagesSnap.docs) {
            const outageId = outageDoc.id;
            
            const pollsSnap = await adminDb.collection("restorationPolls")
                .where("outage_id", "==", outageId)
                .get();

            if (!pollsSnap.empty) {
                let yesCount = 0;
                let noCount = 0;

                pollsSnap.docs.forEach((doc) => {
                   if (doc.data().response === "yes") yesCount++;
                   if (doc.data().response === "no") noCount++;
                });

                const total = yesCount + noCount;

                if (total >= 5 && (yesCount / total) >= 0.6) {
                    await adminDb.collection("outages").doc(outageId).update({
                        status: "restored",
                        resolved_at: new Date().toISOString()
                    });
                    updatedOutages++;
                }
            }
        }
        
        return NextResponse.json({ message: "OK", updatedOutages }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
