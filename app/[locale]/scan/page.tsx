"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ScanLine, AlertTriangle, Zap } from "lucide-react";
import { useRouter } from "@/i18n/routing";

export default function ScanPage() {
  const t = useTranslations("scan");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [progressStep, setProgressStep] = useState(0); // For step 2
  const [appliances, setAppliances] = useState<string[]>([]);

  const toggleAppliance = (value: string) => {
    setAppliances((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
    );
  };

  const startAnalysis = () => {
    setStep(2);
    // Simulate steps
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setProgressStep(current);
      if (current >= 4) {
        clearInterval(interval);
        setTimeout(() => setStep(3), 600);
      }
    }, 1200);
  };

  return (
    <main className="px-4 pb-[88px] pt-4 flex flex-col min-h-screen">
      {/* Top Header */}
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

      {step === 1 && (
        <div className="flex flex-col flex-1">
          <div className="border-2 border-dashed border-[var(--bg-border)] rounded-md h-[240px] flex flex-col items-center justify-center mb-4 bg-[var(--bg-surface)]">
            <ScanLine
              width={32}
              height={32}
              className="text-[var(--amber)] mb-3"
            />
            <p className="text-[13px] text-[var(--text-secondary)]">
              {t("upload_prompt")}
            </p>
          </div>
          <div className="flex space-x-3 mb-2">
            <button
              onClick={startAnalysis}
              className="flex-1 py-3 bg-[var(--amber)] text-[#0C0C0C] font-bold rounded-md hover:bg-[#D97706] transition-colors text-[13px]"
            >
              {t("btn_take_photo")}
            </button>
            <button className="flex-1 py-3 bg-transparent border border-[var(--bg-border)] text-[var(--text-primary)] font-semibold rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[13px]">
              {t("btn_upload")}
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] text-center">
            JPG, PNG, HEIC, PDF
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col flex-1 items-center justify-center">
          <h2 className="text-[20px] font-bold text-[var(--amber)] font-sans tracking-tight mb-12">
            WattHai
          </h2>
          <div className="flex flex-col space-y-6 w-full max-w-[240px]">
            {[
              t("progress_uploading"),
              t("progress_reading"),
              t("progress_extracting"),
              t("progress_calculating"),
            ].map((label, idx) => {
              const prev = progressStep > idx;
              const current = progressStep === idx;
              return (
                <div key={idx} className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${prev ? "bg-[var(--amber)] border-[var(--amber)]" : current ? "border-[var(--amber)] scale-110" : "border-[var(--bg-border)]"}`}
                  />
                  <span
                    className={`text-[13px] ${current ? "text-[var(--text-primary)] opacity-100 animate-pulse" : prev ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col space-y-8 flex-1">
          {/* Bill Breakdown */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
              {t("section_breakdown")} &mdash; MAR 2026
            </h2>
            <div className="text-[34px] font-mono text-[var(--text-primary)] leading-none mb-3">
              Rs. 4,820
            </div>
            {/* Stacked bar */}
            <div className="flex w-full h-[12px] bg-[var(--bg-elevated)] mb-4 rounded-none cursor-pointer">
              <div
                className="bg-[var(--amber)] hover:opacity-80 transition-opacity"
                style={{ width: "50%" }}
              />
              <div
                className="bg-[var(--teal)] hover:opacity-80 transition-opacity"
                style={{ width: "25%" }}
              />
              <div
                className="bg-[#6366F1] hover:opacity-80 transition-opacity"
                style={{ width: "15%" }}
              />
              <div
                className="bg-[#64748B] hover:opacity-80 transition-opacity"
                style={{ width: "10%" }}
              />
            </div>

            <div className="space-y-0 text-[13px]">
              {[
                {
                  label: t("charge_energy"),
                  labelUr: "توانائی چارجز",
                  val: "2,410",
                },
                {
                  label: t("charge_fca"),
                  labelUr: "ایندھن لاگت ایڈجسٹمنٹ",
                  val: "1,205",
                },
                { label: t("charge_fixed"), labelUr: "فکسڈ چارجز", val: "723" },
                { label: t("charge_duty"), labelUr: "بجلی ڈیوٹی", val: "120" },
                { label: t("charge_gst"), labelUr: "جی ایس ٹی", val: "241" },
                { label: t("charge_other"), labelUr: "دیگر ٹیکس", val: "121" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center py-2 border-b border-[var(--bg-border)] last:border-0 hover:bg-[var(--bg-surface)] px-1 -mx-1 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-[var(--text-primary)] leading-snug">
                      {item.label}
                    </span>
                    <span
                      className="text-[11px] font-urdu text-[var(--text-muted)]"
                      dir="rtl"
                    >
                      {item.labelUr}
                    </span>
                  </div>
                  <span className="font-mono text-[var(--text-primary)]">
                    {item.val}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-[var(--bg-border)] px-1 -mx-1">
                <span className="font-semibold text-[15px]">
                  {t("charge_total")}
                </span>
                <span className="font-mono font-medium text-[15px]">4,820</span>
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
                450
              </span>
              <span className="text-[15px] text-[var(--text-secondary)] ml-2">
                units this month
              </span>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center w-full">
                <div
                  className="bg-[var(--amber)] h-[12px]"
                  style={{ width: "100%" }}
                />
                <span className="font-mono text-[11px] text-[var(--text-secondary)] ml-3 whitespace-nowrap">
                  You &mdash; 450
                </span>
              </div>
              <div className="flex items-center w-full">
                <div
                  className="bg-[var(--text-muted)] h-[12px]"
                  style={{ width: "84%" }}
                />
                <span className="font-mono text-[11px] text-[var(--text-secondary)] ml-3 whitespace-nowrap">
                  Zone avg &mdash; 380
                </span>
              </div>
            </div>

            <p className="text-[15px] text-[var(--text-primary)] mb-2">
              You&apos;re using 18% more than the average Defence household.
              High evening AC usage is the most likely cause.
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {t("benchmark_note")}
            </p>
          </section>

          {/* Appliances Input */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
              {t("section_appliances")}
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Tell us what you have for more accurate tips
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                "AC",
                "Inverter/UPS",
                "Geyser",
                "Fridge",
                "Water Pump",
                "Heavy Iron",
              ].map((app) => (
                <button
                  key={app}
                  onClick={() => toggleAppliance(app)}
                  className={`p-2 text-[13px] font-medium border rounded text-left transition-colors ${appliances.includes(app) ? "border-[var(--amber)] bg-[#1C1500] text-[var(--amber)]" : "border-[var(--bg-border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}
                >
                  {app}
                </button>
              ))}
            </div>
            <button className="w-full py-3 bg-[var(--amber)] text-[#0C0C0C] font-bold rounded-md hover:bg-[#D97706] transition-colors text-[13px]">
              {t("btn_get_tips")}
            </button>
          </section>

          {/* Savings Tips */}
          <section>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
              {t("section_tips")}
            </h2>
            <div className="space-y-3">
              <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-md p-4">
                <div className="flex items-center mb-2">
                  <Zap
                    width={16}
                    height={16}
                    className="text-[var(--amber)] mr-2"
                  />
                  <span className="font-mono text-[11px] bg-[var(--bg-border)] px-1.5 py-0.5 rounded-sm mr-2 uppercase">
                    AC Usage
                  </span>
                  <span className="font-mono text-[11px] bg-[var(--bg-base)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-sm uppercase border border-[var(--bg-border)]">
                    {t("effort_medium")}
                  </span>
                </div>
                <p className="text-[15px] mb-3">
                  Set your AC to 26°C and use a fan. With the current FCA rate,
                  running it at 20°C is costing you an extra Rs. 22/hour.
                </p>
                <span className="font-mono text-[11px] font-medium bg-[#042F2E] text-[var(--teal)] px-1.5 py-0.5 rounded-sm">
                  Save Rs. 900–1,800
                </span>
              </div>
            </div>
          </section>

          <button className="text-[13px] text-[var(--text-muted)] underline text-center w-full mt-4 pb-8 hover:text-[var(--text-primary)] transition-colors">
            {t("edit_prompt")}
          </button>
        </div>
      )}
    </main>
  );
}
