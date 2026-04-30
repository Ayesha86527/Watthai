import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';
import { GoogleGenAI } from '@google/genai';

function safeParseJSON(raw: string): any[] {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return [];
    }
  }
}

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

  // Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Parse body
  let billId: string;
  let appliances: string[];
  try {
    const body = await req.json();
    if (!body.bill_id) throw new Error('bill_id is required');
    billId = body.bill_id;
    appliances = Array.isArray(body.appliances) ? body.appliances : [];
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Fetch bill
  const billSnap = await adminDb.collection('bills').doc(billId).get();
  if (!billSnap.exists) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }
  const bill = billSnap.data()!;
  if (bill.user_id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const prompt = `You are a home energy savings advisor for Karachi, Pakistan.
Generate 3–5 specific actionable tips based on this bill and appliances.
Return ONLY a valid JSON array — no markdown, no preamble.

Bill: ${JSON.stringify({
  units_consumed:       bill.units_consumed,
  energy_charges:       bill.energy_charges,
  fuel_cost_adjustment: bill.fuel_cost_adjustment,
  fca_rate_per_unit:    bill.fca_rate_per_unit ?? 4.2,
  fixed_charges:        bill.fixed_charges,
  total_payable:        bill.total_payable,
  consumer_category:    bill.consumer_category,
})}
Appliances: ${JSON.stringify(appliances)}

Each tip object:
{
  "tip_en": string (max 70 words, Karachi-specific — reference FCA, summer heat, load-shedding as relevant),
  "tip_ur": string (proper Urdu, max 70 words),
  "estimated_saving_min_rs": number,
  "estimated_saving_max_rs": number,
  "effort": "low" | "medium" | "high",
  "category": "ac" | "lighting" | "timing" | "inverter" | "geyser" | "general"
}

Be specific: "reducing AC from 8 to 6 hours saves ~Rs.X" not "use AC less".`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

    const tips = safeParseJSON(response.text ?? '[]');

    // Save tips back to bill document
    await adminDb.collection('bills').doc(billId).update({ tips_json: tips });

    return NextResponse.json({ tips });

  } catch (error: any) {
    console.error('savings-tips error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}