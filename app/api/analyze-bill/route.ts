import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';
import { GoogleGenAI } from '@google/genai';
import vision from '@google-cloud/vision';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExtractedBill {
  consumer_number:      string | null;
  reference_number:     string | null;
  billing_month:        string | null;
  previous_reading:     number | null;
  current_reading:      number | null;
  units_consumed:       number | null;
  energy_charges:       number | null;
  fuel_cost_adjustment: number | null;
  fca_rate_per_unit:    number | null;
  fixed_charges:        number | null;
  electricity_duty:     number | null;
  gst:                  number | null;
  other_taxes:          number | null;
  total_payable:        number | null;
  due_date:             string | null;
  arrears:              number | null;
  notices:              string[];
  anomalies:            string[];
  consumer_category:    string | null;
  confidence_score:     number;
}

interface BenchmarkResult {
  avg_units:   number;
  delta_pct:   number;
  explanation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJSON(raw: string): Record<string, any> | null {
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
      return null;
    }
  }
}

function computeConfidence(data: Record<string, any>): number {
  const critical = [
    'units_consumed', 'energy_charges', 'fuel_cost_adjustment',
    'total_payable', 'billing_month', 'due_date',
  ];
  const filled = critical.filter(f => data[f] != null).length;
  return parseFloat((filled / critical.length).toFixed(2));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ─── Stage 1: Vision OCR ─────────────────────────────────────────────────────

async function extractTextWithVision(imageBase64: string): Promise<string> {
  // MOVED THESE INSIDE: This is the ONLY way to fix the "Unexpected end of JSON" build error
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64 || '{}', 'base64').toString()
  );

  const visionClient = new vision.ImageAnnotatorClient({
    credentials: {
      client_email: serviceAccount.client_email,
      // FIXED: Added newline replacement to ensure the private key works in Cloud Run
      private_key: serviceAccount.private_key?.replace(/\\n/g, '\n'),
    },
    projectId: serviceAccount.project_id,
  });

  const [result] = await visionClient.documentTextDetection({
    image: { content: imageBase64 },
    imageContext: { languageHints: ['en', 'ur'] },
  });

  const fullText = result.fullTextAnnotation?.text;
  if (!fullText || fullText.trim().length < 50) {
    throw new Error(
      'Vision API returned insufficient text. ' +
      'Please retake the photo in good lighting with the full bill visible.'
    );
  }

  const pages = result.fullTextAnnotation?.pages ?? [];
  const avgConf = pages.length > 0
    ? pages.reduce((s: number, p: any) => s + (p.confidence ?? 0), 0) / pages.length
    : null;
  console.log(`Vision OCR: ${fullText.length} chars, confidence: ${avgConf?.toFixed(2) ?? 'n/a'}`);

  return fullText;
}

// ─── Stage 2: Gemini extraction ───────────────────────────────────────────────

async function extractBillData(
  ai: GoogleGenAI,
  ocrText: string,
): Promise<Record<string, any>> {
  const prompt = `You are an expert K-Electric bill analyst for Karachi, Pakistan (2025–2026 bill format).

Below is raw OCR text from a K-Electric bill. The text may have OCR artifacts.
Pakistani rupee amounts are plain numbers (e.g. 4820 or 4,820).
Dates are in DD/MM/YYYY or MM/YYYY format.

Return ONLY valid JSON — no markdown, no preamble.

{
  "consumer_number": string | null,
  "reference_number": string | null,
  "billing_month": string | null,
  "previous_reading": number | null,
  "current_reading": number | null,
  "units_consumed": number | null,
  "energy_charges": number | null,
  "fuel_cost_adjustment": number | null,
  "fca_rate_per_unit": number | null,
  "fixed_charges": number | null,
  "electricity_duty": number | null,
  "gst": number | null,
  "other_taxes": number | null,
  "total_payable": number | null,
  "due_date": string | null,
  "arrears": number | null,
  "notices": string[],
  "anomalies": string[],
  "consumer_category": string | null
}

Flag anomalies if:
- fuel_cost_adjustment > energy_charges * 0.40
- fixed_charges > 500 for residential consumer
- arrears > total_payable * 0.30
- notices mention "load shedding relief", "credit adjustment", or "duplicate"
- units_consumed is 0 but total_payable > 0

OCR TEXT:
---
${ocrText}
---`;

  // RESTORED: Exactly as your original file
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });

  const parsed = safeParseJSON(response.text ?? '{}');
  if (!parsed) {
    throw new Error(
      `Gemini returned unparseable JSON: ${(response.text ?? '').slice(0, 200)}`
    );
  }
  return parsed;
}

// ─── Benchmarking ─────────────────────────────────────────────────────────────

async function getBenchmark(
  ai: GoogleGenAI,
  zoneId: string,
  units: number,
): Promise<BenchmarkResult | null> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const prevMonth = new Date(
    new Date().setMonth(new Date().getMonth() - 1)
  ).toISOString().slice(0, 7);

  let benchmarkData: FirebaseFirestore.DocumentData | null = null;
  for (const month of [currentMonth, prevMonth]) {
    const snap = await adminDb
      .collection('zoneBenchmarks')
      .where('zone_id', '==', zoneId)
      .where('month', '==', month)
      .limit(1)
      .get();
    if (!snap.empty) {
      benchmarkData = snap.docs[0].data();
      break;
    }
  }

  if (!benchmarkData?.avg_units) return null;

  const avg = benchmarkData.avg_units as number;
  const deltaPct = parseFloat(((units - avg) / avg * 100).toFixed(1));

  // RESTORED: Exactly as your original file
  const explainRes = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{
        text: `A Karachi K-Electric household used ${units} units. Area average is ${avg} units (${deltaPct > 0 ? '+' : ''}${deltaPct}%). Write one specific sentence (max 40 words) explaining this — mention likely causes if above average (AC, summer heat, inverter). Plain text only.`,
      }],
    }],
  });

  return {
    avg_units:   avg,
    delta_pct:   deltaPct,
    explanation: explainRes.text?.trim() ?? '',
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
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

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }
  
  // RESTORED: Exactly as your original file
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  let imageBase64: string;
  let zoneId: string | null;
  try {
    const body = await req.json();
    if (!body.imageBase64) throw new Error('imageBase64 is required');
    imageBase64 = body.imageBase64;
    zoneId = body.zone_id ?? null;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    const ocrText = await withRetry(
      () => extractTextWithVision(imageBase64), 3
    );

    const rawExtracted = await withRetry(
      () => extractBillData(ai, ocrText), 3
    );

    const confidenceScore = computeConfidence(rawExtracted);

    const extracted: ExtractedBill = {
      consumer_number:      rawExtracted.consumer_number      ?? null,
      reference_number:     rawExtracted.reference_number     ?? null,
      billing_month:        rawExtracted.billing_month        ?? null,
      previous_reading:     rawExtracted.previous_reading     ?? null,
      current_reading:      rawExtracted.current_reading      ?? null,
      units_consumed:       rawExtracted.units_consumed       ?? null,
      energy_charges:       rawExtracted.energy_charges       ?? null,
      fuel_cost_adjustment: rawExtracted.fuel_cost_adjustment ?? null,
      fca_rate_per_unit:    rawExtracted.fca_rate_per_unit    ?? null,
      fixed_charges:        rawExtracted.fixed_charges        ?? null,
      electricity_duty:     rawExtracted.electricity_duty     ?? null,
      gst:                  rawExtracted.gst                  ?? null,
      other_taxes:          rawExtracted.other_taxes          ?? null,
      total_payable:        rawExtracted.total_payable        ?? null,
      due_date:             rawExtracted.due_date             ?? null,
      arrears:              rawExtracted.arrears              ?? null,
      notices:   Array.isArray(rawExtracted.notices)   ? rawExtracted.notices   : [],
      anomalies: Array.isArray(rawExtracted.anomalies) ? rawExtracted.anomalies : [],
      consumer_category:    rawExtracted.consumer_category    ?? null,
      confidence_score:     confidenceScore,
    };

    const benchmark = zoneId
      ? await getBenchmark(ai, zoneId, extracted.units_consumed ?? 0)
      : null;

    const docRef = adminDb.collection('bills').doc();
    await docRef.set({
      user_id:        userId,
      ...extracted,
      benchmark_json: benchmark,
      ocr_text:       ocrText,
      created_at:     new Date().toISOString(),
    });

    return NextResponse.json({
      bill_id:        docRef.id,
      extracted,
      benchmark,
      low_confidence: confidenceScore < 0.5,
      warnings: confidenceScore < 0.5
        ? ['Some fields could not be read clearly. Please review and edit if needed.']
        : [],
    });

  } catch (error: any) {
    console.error('analyze-bill error:', error.message);
    const isVisionError =
      error.message?.includes('Vision') ||
      error.message?.includes('blurry') ||
      error.message?.includes('insufficient text');

    return NextResponse.json({
      error: isVisionError
        ? 'Could not read the bill image. Please retake in good lighting with the full bill visible.'
        : 'Bill analysis failed. Please try again or enter details manually.',
      detail: error.message,
    }, { status: 500 });
  }
}