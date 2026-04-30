"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { BottomNav } from "@/components/shared/BottomNav";
import { FileText, ScanLine, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "@/i18n/routing";

interface Bill {
  id: string;
  billing_month: string;
  units_consumed: number;
  total_payable: number;
  energy_charges: number;
  fuel_cost_adjustment: number;
  fixed_charges: number;
  gst: number;
  benchmark_json?: { delta_pct: number; avg_units: number };
  created_at: string;
  low_confidence?: boolean;
}

export default function BillsPage() {
  const router = useRouter();
  const [bills, setBills]     = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/onboarding"); return; }
      setUserId(user.uid);

      try {
        const q = query(
          collection(db, "bills"),
          where("user_id", "==", user.uid),
          orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);
        setBills(
          snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill))
        );
      } catch (err) {
        console.error("Bills fetch error:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <>
      <main className="px-4 pt-4 pb-[88px]">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
            YOUR BILLS
          </p>
          <h1 className="text-[26px] font-bold text-[var(--text-primary)]">
            Bill History
          </h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded animate-pulse" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded flex items-center justify-center mb-4">
              <FileText width={24} height={24} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-[17px] font-semibold text-[var(--text-primary)] mb-2">
              No bills yet
            </p>
            <p className="text-[14px] text-[var(--text-muted)] mb-8 max-w-[240px]">
              Scan your first K-Electric bill to see a full breakdown and savings tips.
            </p>
            <Link
              href="/scan"
              className="flex items-center space-x-2 px-6 py-3 bg-[var(--amber)] text-[#0C0C0C] font-bold rounded hover:bg-[#D97706] transition-colors"
            >
              <ScanLine width={16} height={16} />
              <span>Scan a Bill</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => {
              const delta = bill.benchmark_json?.delta_pct ?? null;
              const isAbove = delta !== null && delta > 0;
              const isBelow = delta !== null && delta < 0;

              return (
                <div
                  key={bill.id}
                  className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded p-4 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                  onClick={() => router.push(`/scan?bill_id=${bill.id}`)}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[13px] text-[var(--text-muted)] mb-0.5">
                        {bill.billing_month ?? "Unknown month"}
                      </p>
                      <p className="text-[26px] font-mono text-[var(--text-primary)] leading-none">
                        Rs.{" "}
                        {bill.total_payable?.toLocaleString() ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[15px] text-[var(--text-secondary)]">
                        {bill.units_consumed?.toLocaleString() ?? "—"}
                        <span className="text-[11px] text-[var(--text-muted)] ml-1">units</span>
                      </p>
                      {delta !== null && (
                        <div className={`flex items-center justify-end space-x-1 mt-1 ${isAbove ? "text-[var(--amber)]" : "text-[var(--teal)]"}`}>
                          {isAbove
                            ? <TrendingUp width={12} height={12} />
                            : <TrendingDown width={12} height={12} />
                          }
                          <span className="font-mono text-[11px]">
                            {isAbove ? "+" : ""}{delta}% vs zone
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stacked charge bar */}
                  <div className="flex w-full h-[6px] rounded-none overflow-hidden mb-3 bg-[var(--bg-elevated)]">
                    {(() => {
                      const total =
                        (bill.energy_charges       ?? 0) +
                        (bill.fuel_cost_adjustment  ?? 0) +
                        (bill.fixed_charges         ?? 0) +
                        (bill.gst                   ?? 0);
                      if (total === 0) return null;
                      const pct = (v: number) =>
                        `${(((v ?? 0) / total) * 100).toFixed(1)}%`;
                      return (
                        <>
                          <div className="bg-[var(--amber)]" style={{ width: pct(bill.energy_charges) }} />
                          <div className="bg-[var(--teal)]"  style={{ width: pct(bill.fuel_cost_adjustment) }} />
                          <div className="bg-[#6366F1]"      style={{ width: pct(bill.fixed_charges) }} />
                          <div className="bg-[#64748B]"      style={{ width: pct(bill.gst) }} />
                        </>
                      );
                    })()}
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-[11px] font-mono text-[var(--text-muted)]">
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-[var(--amber)] inline-block" />
                        <span>Energy</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-[var(--teal)] inline-block" />
                        <span>FCA</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-[#6366F1] inline-block" />
                        <span>Fixed</span>
                      </span>
                    </div>
                    {bill.low_confidence && (
                      <div className="flex items-center space-x-1 text-[11px] text-[var(--amber)]">
                        <AlertTriangle width={11} height={11} />
                        <span>Review needed</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}