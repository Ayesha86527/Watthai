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
    try { return JSON.parse(cleaned); }
    catch { return []; }
  }
}

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

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  let billId: string;
  let appliancesFromUI: string[];
  try {
    const body = await req.json();
    if (!body.bill_id) throw new Error('bill_id is required');
    billId     = body.bill_id;
    appliancesFromUI = Array.isArray(body.appliances) ? body.appliances : [];
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

  // ── Fetch user profile for personalization ──
  const userSnap = await adminDb.collection('users').doc(userId).get();
  const user = userSnap.exists ? userSnap.data()! : {};

  // Merge appliances from onboarding profile + what user selected on scan page
  const profileAppliances: string[] = [];
  if (user.ac_count > 0)          profileAppliances.push(`${user.ac_count} AC(s)`);
  if (user.has_inverter)          profileAppliances.push('Inverter/UPS');
  if (user.has_geyser)            profileAppliances.push('Geyser');
  if (user.has_washing_machine)   profileAppliances.push('Washing Machine');
  if (user.has_water_pump)        profileAppliances.push('Water Pump');

  // UI selections take priority, profile fills gaps
  const finalAppliances = appliancesFromUI.length > 0
    ? appliancesFromUI
    : profileAppliances;

  try {
    const prompt = `You are a home energy savings advisor for Karachi, Pakistan. It is summer 2026.

HOUSEHOLD PROFILE:
- Name: ${user.name ?? 'User'}
- Zone: ${user.zone_id ?? 'Karachi'}
- People in house: ${user.persons_in_house ?? 'unknown'}
- Rooms: ${user.rooms ?? 'unknown'}
- ACs: ${user.ac_count ?? 0}
- Appliances: ${finalAppliances.join(', ') || 'basic appliances'}

BILL DATA:
- Units consumed: ${bill.units_consumed} kWh
- Energy charges: Rs. ${bill.energy_charges}
- Fuel Cost Adjustment (FCA): Rs. ${bill.fuel_cost_adjustment} (rate: Rs. ${bill.fca_rate_per_unit ?? 4.2}/unit)
- Fixed charges: Rs. ${bill.fixed_charges}
- Total payable: Rs. ${bill.total_payable}
- Consumer category: ${bill.consumer_category ?? 'residential'}

Generate 4-5 SPECIFIC savings tips. Each tip MUST:
- Include exact rupee savings based on the actual bill numbers above
- Reference the specific number of ACs, rooms, people in this household
- Mention Karachi-specific context (summer heat, load-shedding, FCA impact)
- Give a concrete action ("reduce AC from 8 to 6 hours" not "use AC less")

Return ONLY a valid JSON array. No markdown, no explanation.

Schema for each object:
{
  "tip_en": "string (max 70 words, specific action with rupee impact)",
  "tip_ur": "string (proper Urdu translation)",
  "saving_min_rs": number,
  "saving_max_rs": number,
  "effort": "low" | "medium" | "high",
  "category": "ac" | "lighting" | "timing" | "inverter" | "geyser" | "general"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

    const tips = safeParseJSON(response.text ?? '[]');

    await adminDb.collection('bills').doc(billId).update({ tips_json: tips });

    return NextResponse.json({ tips });

  } catch (error: any) {
    console.error('savings-tips error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}