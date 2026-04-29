import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const aiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!aiApiKey) {
        return NextResponse.json({ error: "Missing Gemini API Key" }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey: aiApiKey });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing Auth" }, { status: 401 });

    const decodedToken = await adminAuth.verifyIdToken(authHeader.replace("Bearer ", ""));
    if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bill_id, appliances } = await req.json();

    const billSnap = await adminDb.collection("bills").doc(bill_id).get();
    if (!billSnap.exists) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    const bill = billSnap.data()!;

    if (bill.user_id !== decodedToken.uid) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const prompt = `You are a home energy savings advisor for Karachi, Pakistan.
Given the bill data and appliances, generate 3–5 specific actionable tips.
Return ONLY a valid JSON array, no markdown.

Bill data: ${JSON.stringify({ 
  units: bill.units_consumed, 
  fca: bill.fuel_cost_adjustment, 
  fca_rate: bill.fca_rate_per_unit || 4.2, 
  total: bill.total_payable 
})}
Appliances: ${JSON.stringify(appliances)}

Each tip object MUST follow this schema:
{
  "tip_en": string (max 70 words, specific to Karachi context — mention FCA impact, summer heat, load-shedding),
  "tip_ur": string (proper Urdu translation, max 70 words),
  "estimated_saving_min_rs": number,
  "estimated_saving_max_rs": number,
  "effort": "low" | "medium" | "high",
  "category": "ac" | "lighting" | "timing" | "inverter" | "geyser" | "general"
}

Base rupee savings estimates on: FCA rate, current residential slab rates.
Be specific — say "reducing AC from 8 to 6 hours" not "use AC less".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const tips = JSON.parse(response.text || "[]");

    // Update bill
    await adminDb.collection("bills").doc(bill_id).update({ tips_json: tips });

    return NextResponse.json({ tips });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
