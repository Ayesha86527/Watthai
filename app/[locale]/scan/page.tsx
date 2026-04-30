"use client";

import { useState, useRef, useEffect } from "react";  // ← add useEffect
import { useTranslations } from "next-intl";
import { ArrowLeft, ScanLine, AlertTriangle, Zap, Camera, Upload, X } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface BillData {
  units_consumed: number;
  total_payable: number;
  energy_charges: number;
  fuel_cost_adjustment: number;
  fixed_charges: number;
  electricity_duty: number;
  gst: number;
  other_taxes: number;
  billing_month: string;
  due_date: string;
  benchmark_json?: {
    avg_units: number;
    delta_pct: number;
    explanation: string;
  };
}

export default function ScanPage() {
  const t = useTranslations("scan");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [progressStep, setProgressStep] = useState(0);
  const [appliances, setAppliances] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [billData, setBillData] = useState<BillData | null>(null);
  const [tips, setTips] = useState<any[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Correct — useEffect runs after mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
      setLoading(false);
      if (!user) {
        router.push("/onboarding");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const toggleAppliance = (value: string) => {
    setAppliances((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, HEIC)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const startAnalysis = async () => {
    if (!imageFile || !userId) return;

    setIsAnalyzing(true);
    setStep(2);
    setProgressStep(0);
    setError(null);

    // Start progress animation immediately — don't wait for API
    let current = 0;
    const progressInterval = setInterval(() => {
      current++;
      setProgressStep(current);
      if (current >= 3) clearInterval(progressInterval); // hold at step 3 until API returns
    }, 800);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const userDoc = await getDoc(doc(db, "users", userId));
      const zoneId = userDoc.exists() ? userDoc.data()?.zone_id : null;

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/analyze-bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64, zone_id: zoneId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Analysis failed");
      }

      // Complete progress
      clearInterval(progressInterval);
      setProgressStep(4);
      localStorage.setItem("last_analyzed_bill_id", result.bill_id);
      setBillData(result.extracted);

      setTimeout(() => setStep(3), 600);

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("Analysis error:", err);
      setError(err.message || "Failed to analyze bill. Please try again.");
      setStep(1);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGetTips = async () => {
    const billId = localStorage.getItem("last_analyzed_bill_id");
    if (!billId) {
      setError("No bill found. Please re-analyze.");
      return;
    }

    setTipsLoading(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/savings-tips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bill_id: billId, appliances }),
      });

      if (!response.ok) throw new Error("Failed to get tips");

      const result = await response.json();
      setTips(result.tips ?? []);   // ← display inline, no alert + redirect
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTipsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />
      </div>
    );
  }

  return (
    <main className="px-4 pb-[88px] pt-4 flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] mr-3 transition-colors p-1"
        >
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
          {t("header")}
        </span>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="flex flex-col flex-1">
          {imagePreview ? (
            <div className="relative mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Bill preview"
                className="w-full h-[300px] object-cover rounded-md border border-[var(--bg-border)]"
              />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 p-2 bg-[var(--bg-base)] rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X width={20} height={20} />
              </button>
              {/* Show Analyze button when image is selected */}
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="flex-1 py-3 bg-transparent border border-[var(--bg-border)] text-[var(--text-primary)] font-semibold rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[13px]"
                >
                  {t("btn_retake")}
                </button>
                <button
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                  className="flex-1 py-3 bg-[var(--amber)] text-[#0C0C0C] font-bold rounded-md hover:bg-[#D97706] transition-colors text-[13px] disabled:opacity-50"
                >
                  {t("btn_analyze")}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--bg-border)] rounded-md h-[240px] flex flex-col items-center justify-center mb-4 bg-[var(--bg-surface)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <ScanLine width={32} height={32} className="text-[var(--amber)] mb-3" />
              <p className="text-[13px] text-[var(--text-secondary)]">{t("upload_prompt")}</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {error && (
            <div className="mb-4 p-3 bg-[#450A0A] border border-[var(--red-alert)] rounded-md flex items-center">
              <AlertTriangle width={16} height={16} className="text-[var(--red-alert)] mr-2" />
              <span className="text-[13px] text-[var(--red-alert)]">{error}</span>
            </div>
          )}

          {!imagePreview && (
            <>
              <div className="flex space-x-3 mb-2">
                <button
                  onClick={handleTakePhoto}
                  className="flex-1 py-3 bg-[var(--amber)] text-[#0C0C0C] font-bold rounded-md hover:bg-[#D97706] transition-colors text-[13px] flex items-center justify-center"
                >
                  <Camera width={16} height={16} className="mr-2" />
                  {t("btn_take_photo")}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-3 bg-transparent border border-[var(--bg-border)] text-[var(--text-primary)] font-semibold rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[13px] flex items-center justify-center"
                >
                  <Upload width={16} height={16} className="mr-2" />
                  {t("btn_upload")}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] text-center">JPG, PNG, HEIC</p>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Processing ── */}
      {step === 2 && (
        <div className="flex flex-col flex-1 items-center justify-center">
          <h2 className="text-[20px] font-bold text-[var(--amber)] mb-12">WattHai</h2>
          <div className="flex flex-col space-y-6 w-full max-w-[240px]">
            {[
              t("progress_uploading"),
              t("progress_reading"),
              t("progress_extracting"),
              t("progress_calculating"),
            ].map((label, idx) => {
              const done    = progressStep > idx;
              const current = progressStep === idx;
              return (
                <div key={idx} className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                    done    ? "bg-[var(--amber)] border-[var(--amber)]" :
                    current ? "border-[var(--amber)] scale-110" :
                              "border-[var(--bg-border)]"
                  }`} />
                  <span className={`text-[13px] transition-opacity ${
                    current ? "text-[var(--text-primary)] animate-pulse" :
                    done    ? "text-[var(--text-secondary)]" :
                              "text-[var(--text-muted)]"
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && billData && (
        <div className="flex flex-col space-y-8 flex-1">

          {/* Bill Breakdown */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
              {t("section_breakdown")} — {billData.billing_month || "Unknown"}
            </h2>
            <div className="text-[34px] font-mono text-[var(--text-primary)] leading-none mb-3">
              Rs. {billData.total_payable?.toLocaleString() ?? 0}
            </div>

            {/* Stacked bar */}
            <div className="flex w-full h-[12px] bg-[var(--bg-elevated)] mb-4">
              {(() => {
                const total =
                  (billData.energy_charges       ?? 0) +
                  (billData.fuel_cost_adjustment  ?? 0) +
                  (billData.fixed_charges         ?? 0) +
                  (billData.gst                   ?? 0);
                if (total === 0) return null;
                const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;
                return (
                  <>
                    <div className="bg-[var(--amber)]"   style={{ width: pct(billData.energy_charges      ?? 0) }} />
                    <div className="bg-[var(--teal)]"    style={{ width: pct(billData.fuel_cost_adjustment ?? 0) }} />
                    <div className="bg-[#6366F1]"        style={{ width: pct(billData.fixed_charges        ?? 0) }} />
                    <div className="bg-[#64748B]"        style={{ width: pct(billData.gst                  ?? 0) }} />
                  </>
                );
              })()}
            </div>

            {/* Line items */}
            <div className="space-y-0 text-[13px]">
              {[
                { label: t("charge_energy"), labelUr: "توانائی چارجز",          val: billData.energy_charges },
                { label: t("charge_fca"),    labelUr: "ایندھن لاگت ایڈجسٹمنٹ", val: billData.fuel_cost_adjustment },
                { label: t("charge_fixed"),  labelUr: "فکسڈ چارجز",             val: billData.fixed_charges },
                { label: t("charge_duty"),   labelUr: "بجلی ڈیوٹی",             val: billData.electricity_duty },
                { label: t("charge_gst"),    labelUr: "جی ایس ٹی",              val: billData.gst },
                { label: t("charge_other"),  labelUr: "دیگر ٹیکس",              val: billData.other_taxes },
              ]
                .filter((item) => item.val != null)
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b border-[var(--bg-border)] last:border-0 hover:bg-[var(--bg-surface)] px-1 -mx-1 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-[var(--text-primary)] leading-snug">{item.label}</span>
                      <span className="text-[11px] text-[var(--text-muted)]" dir="rtl">{item.labelUr}</span>
                    </div>
                    <span className="font-mono text-[var(--text-primary)]">
                      {item.val?.toLocaleString() ?? 0}
                    </span>
                  </div>
                ))}
              <div className="flex justify-between items-center pt-3 border-t-2 border-[var(--bg-border)] px-1 -mx-1">
                <span className="font-semibold text-[15px]">{t("charge_total")}</span>
                <span className="font-mono font-medium text-[15px]">
                  {billData.total_payable?.toLocaleString() ?? 0}
                </span>
              </div>
            </div>
          </section>

          {/* Benchmarking */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
              {t("section_benchmark")}
            </h2>
            <div className="mb-4">
              <span className="text-[26px] font-mono text-[var(--text-primary)]">
                {billData.units_consumed?.toLocaleString() ?? 0}
              </span>
              <span className="text-[15px] text-[var(--text-secondary)] ml-2">units this month</span>
            </div>

            {billData.benchmark_json ? (
              <>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center w-full">
                    <div className="bg-[var(--amber)] h-[12px]" style={{ width: "100%" }} />
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] ml-3 whitespace-nowrap">
                      You — {billData.units_consumed?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center w-full">
                    <div
                      className="bg-[#64748B] h-[12px]"
                      style={{
                        width: `${Math.min(100, (billData.benchmark_json.avg_units / (billData.units_consumed || 1)) * 100)}%`,
                      }}
                    />
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] ml-3 whitespace-nowrap">
                      Zone avg — {billData.benchmark_json.avg_units.toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-[15px] text-[var(--text-primary)] mb-2">
                  {billData.benchmark_json.explanation}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">
                Benchmark data not available for your area yet.
              </p>
            )}
            <p className="text-[11px] text-[var(--text-muted)]">{t("benchmark_note")}</p>
          </section>

          {/* Appliances + Tips */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
              {t("section_appliances")}
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Tell us what you have for more accurate tips
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {["AC", "Inverter/UPS", "Geyser", "Fridge", "Water Pump", "Heavy Iron"].map((app) => (
                <button
                  key={app}
                  onClick={() => toggleAppliance(app)}
                  className={`p-2 text-[13px] font-medium border rounded text-left transition-colors ${
                    appliances.includes(app)
                      ? "border-[var(--amber)] bg-[#1C1500] text-[var(--amber)]"
                      : "border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>
            <button
              onClick={handleGetTips}
              disabled={tipsLoading}
              className="w-full py-3 bg-[var(--amber)] text-[#0C0C0C] font-bold rounded-md hover:bg-[#D97706] transition-colors text-[13px] disabled:opacity-50"
            >
              {tipsLoading ? "Generating..." : t("btn_get_tips")}
            </button>
          </section>

          {/* Tips display — shown after handleGetTips resolves */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
              {t("section_tips")}
            </h2>

            {tips.length > 0 ? (
              <div className="space-y-3">
                {tips.map((tip: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-md p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                        {tip.category}
                      </span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-sm ${
                        tip.effort === "low"    ? "bg-[#042F2E] text-[var(--teal)]" :
                        tip.effort === "medium" ? "bg-[#451A03] text-[var(--amber)]" :
                                                  "bg-[#450A0A] text-[var(--red-alert)]"
                      }`}>
                        {tip.effort?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[15px] text-[var(--text-primary)] mb-3">{tip.tip_en}</p>
                    <div className="inline-block bg-[#042F2E] text-[var(--teal)] font-mono text-[11px] px-2 py-1 rounded-sm">
                      Save Rs. {tip.estimatedSavingMinRs?.toLocaleString()}–{tip.estimatedSavingMaxRs?.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-md p-4 text-center">
                <p className="text-[13px] text-[var(--text-secondary)] mb-3">
                  Select your appliances above and tap &quot;Get My Tips&quot;
                </p>
                <Zap width={32} height={32} className="text-[var(--amber)] mx-auto opacity-50" />
              </div>
            )}
          </section>

          <button
            onClick={() => { setStep(1); setImageFile(null); setImagePreview(null); setBillData(null); setTips([]); }}
            className="text-[13px] text-[var(--text-muted)] underline text-center w-full mt-4 pb-8 hover:text-[var(--text-primary)] transition-colors"
          >
            {t("edit_prompt")}
          </button>
        </div>
      )}
    </main>
  );
}