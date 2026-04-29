import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/server';
import { GoogleGenAI } from '@google/genai';
import vision from '@google-cloud/vision';

const visionClient = new vision.ImageAnnotatorClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedBill {
  consumer_number: string | null;
  reference_number: string | null;
  billing_month: string | null;
  previous_reading: number | null;
  current_reading: number | null;
  units_consumed: number | null;
  energy_charges: number | null;
  fuel_cost_adjustment: number | null;
  fca_rate_per_unit: number | null;
  fixed_charges: number | null;
  electricity_duty: number | null;
  gst: number | null;
  other_taxes: number | null;
  total_payable: number | null;
  due_date: string | null;
  arrears: number | null;
  notices: string[];
  anomalies: string[];
  consumer_category: string | null;
  confidence_score: number; // 0–1, we compute this
}

interface BenchmarkResult {
  avg_units: number;
  delta_pct: number;
  explanation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Safe JSON parse — tries cleaning markdown fences before failing
function safeParseJSON(raw: string): Record<string, any> | null {
  try {
    return JSON.parse(raw);
  } catch {
    // Strip ```json ... ``` fences if Gemini ignored the instruction
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

// Compute a simple confidence score based on how many critical fields were extracted
function computeConfidence(data: Record<string, any>): number {
  const criticalFields = [
    'units_consumed',
    'energy_charges',
    'fuel_cost_adjustment',
    'total_payable',
    'billing_month',
    'due_date',
  ];
  const filled = criticalFields.filter(
    (f) => data[f] !== null && data[f] !== undefined
  ).length;
  return parseFloat((filled / criticalFields.length).toFixed(2));
}

// Retry wrapper — retries up to maxRetries times with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ─── Stage 1: Cloud Vision OCR ────────────────────────────────────────────────

async function extractTextWithVision(imageBase64: string): Promise<string> {
  const [result] = await visionClient.documentTextDetection({
    image: { content: imageBase64 },
    imageContext: {
      // Hint both languages — Vision handles mixed English/Urdu bills
      languageHints: ['en', 'ur'],
    },
  });

  const fullText = result.fullTextAnnotation?.text;

  if (!fullText || fullText.trim().length < 50) {
    throw new Error(
      'Vision API returned insufficient text — image may be too blurry or low resolution.'
    );
  }

  // Log confidence from Vision for debugging
  const pages = result.fullTextAnnotation?.pages || [];
  const avgConfidence =
    pages.length > 0
      ? pages.reduce((sum, p) => sum + (p.confidence || 0), 0) / pages.length
      : null;

  console.log(
    `Vision OCR complete — ${fullText.length} chars, avg page confidence: ${avgConfidence?.toFixed(2) ?? 'n/a'}`
  );

  return fullText;
}

// ─── Stage 2: Gemini structured extraction from OCR text ─────────────────────

async function extractBillDataWithGemini(
  ai: GoogleGenAI,
  ocrText: string
): Promise<Record<string, any>> {
  const prompt = `You are an expert K-Electric bill analyst for Karachi, Pakistan (2025–2026 bill format).

Below is raw OCR text extracted from a K-Electric electricity bill using Google Cloud Vision API.
The text may contain OCR artifacts — use context and number patterns to interpret values correctly.
Pakistani rupee amounts are formatted as plain numbers (e.g. 4820 or 4,820).
Dates are typically in DD/MM/YYYY or MM/YYYY format.

Extract all fields and return ONLY valid JSON matching this schema exactly.
No markdown, no preamble, no explanation — raw JSON only.

Schema:
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

Anomaly rules — add a plain-English string to anomalies[] if any of these are true:
- fuel_cost_adjustment > energy_charges * 0.40
- fixed_charges > 500 and consumer_category includes "residential"
- arrears > total_payable * 0.30
- Any notice mentions "load shedding relief", "credit adjustment", or "duplicate"
- units_consumed is 0 but total_payable > 0

OCR TEXT:
---
${ocrText}
---`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });

  const raw = response.text ?? '{}';
  const parsed = safeParseJSON(raw);

  if (!parsed) {
    throw new Error(`Gemini returned unparseable JSON. Raw output: ${raw.slice(0, 200)}`);
  }

  return parsed;
}

// ─── Benchmarking ─────────────────────────────────────────────────────────────

async function getBenchmark(
  ai: GoogleGenAI,
  zoneId: string,
  units: number
): Promise<BenchmarkResult | null> {
  const nowMonth = new Date().toISOString().slice(0, 7); // "2026-04"

  const benchmarkSnap = await adminDb
    .collection('zoneBenchmarks')
    .where('zone_id', '==', zoneId)
    .where('month', '==', nowMonth)
    .limit(1)
    .get();

  // Fallback to previous month if current month has no data yet
  let benchmarkDoc = benchmarkSnap.empty ? null : benchmarkSnap.docs[0].data();

  if (!benchmarkDoc) {
    const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .slice(0, 7);
    const fallbackSnap = await adminDb
      .collection('zoneBenchmarks')
      .where('zone_id', '==', zoneId)
      .where('month', '==', prevMonth)
      .limit(1)
      .get();
    benchmarkDoc = fallbackSnap.empty ? null : fallbackSnap.docs[0].data();
  }

  if (!benchmarkDoc?.avg_units) return null;

  const avg = benchmarkDoc.avg_units as number;
  const deltaPct = parseFloat(((units - avg) / avg * 100).toFixed(1));

  const explainPrompt = `A Karachi K-Electric household consumed ${units} units this month. 
Their area average is ${avg} units (delta: ${deltaPct > 0 ? '+' : ''}${deltaPct}%).
Write one sentence explaining this comparison — be specific, mention likely causes if above average (AC, summer heat, inverter charging). 
Maximum 40 words. Plain text only, no formatting.`;

  const explResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: explainPrompt }] }],
  });

  return {
    avg_units: avg,
    delta_pct: deltaPct,
    explanation: explResponse.text?.trim() ?? '',
  };
}

// ─── Main Route Handler ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Auth ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or malformed Authorization header' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.replace('Bearer ', ''));
    userId = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // ── Gemini client ──
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // ── Parse body ──
  let imageBase64: string;
  let zoneId: string | null;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    zoneId = body.zone_id ?? null;
    if (!imageBase64) throw new Error('imageBase64 is required');
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    // ── Stage 1: Vision OCR (with retry) ──
    const ocrText = await withRetry(() => extractTextWithVision(imageBase64), 3);

    // ── Stage 2: Gemini extraction (with retry) ──
    const rawExtracted = await withRetry(
      () => extractBillDataWithGemini(ai, ocrText),
      3
    );

    // ── Confidence scoring ──
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
      notices:              Array.isArray(rawExtracted.notices)   ? rawExtracted.notices   : [],
      anomalies:            Array.isArray(rawExtracted.anomalies) ? rawExtracted.anomalies : [],
      consumer_category:    rawExtracted.consumer_category    ?? null,
      confidence_score:     confidenceScore,
    };

    // ── Warn on low confidence — don't block, let user manually edit ──
    const lowConfidence = confidenceScore < 0.5;

    // ── Benchmarking ──
    const benchmark = zoneId
      ? await getBenchmark(ai, zoneId, extracted.units_consumed ?? 0)
      : null;

    // ── Save to Firestore ──
    const docRef = adminDb.collection('bills').doc();
    await docRef.set({
      user_id:        userId,
      ...extracted,
      benchmark_json: benchmark,
      ocr_text:       ocrText,        // store raw OCR for debugging/re-analysis
      created_at:     new Date().toISOString(),
    });

    return NextResponse.json({
      bill_id:        docRef.id,
      extracted,
      benchmark,
      low_confidence: lowConfidence,  // frontend shows "please verify" banner if true
      warnings:       lowConfidence
        ? ['Some fields could not be extracted with high confidence. Please review and edit before saving.']
        : [],
    });

  } catch (error: any) {
    console.error('Bill analysis pipeline error:', error.message);

    // Differentiate Vision errors from Gemini errors in response
    const isVisionError = error.message?.includes('Vision') || error.message?.includes('blurry');

    return NextResponse.json(
      {
        error: isVisionError
          ? 'Could not read the bill image clearly. Please retake the photo in good lighting with the full bill visible.'
          : 'Bill analysis failed. Please try again or enter details manually.',
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
