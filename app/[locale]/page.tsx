"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Bell, ScanLine, ChevronRight, Zap } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, query, where, getDocs,
  orderBy, limit, doc, getDoc,
} from "firebase/firestore";
import { ZONES } from "@/lib/config";

interface BillData {
  billing_month:        string;
  total_payable:        number;
  units_consumed:       number;
  energy_charges:       number;
  fuel_cost_adjustment: number;
  fixed_charges:        number;
  gst:                  number;
  due_date:             string;
  benchmark_json?: {
    delta_pct: number;
    avg_units: number;
  };
  tips_json?: Array<{
    estimated_saving_max_rs: number;
  }>;
}

interface NewsItem {
  id:     string;
  title:  string;
  source: string;
  publishedAt?: string;
}

export default function Dashboard() {
  const t    = useTranslations("dashboard");
  const router = useRouter();

  const [userName, setUserName]       = useState<string>("");
  const [userZoneName, setUserZoneName] = useState<string>("");
  const [hasBill, setHasBill]         = useState(false);
  const [billData, setBillData]       = useState<BillData | null>(null);
  const [hasOutage, setHasOutage]     = useState(false);
  const [news, setNews]               = useState<NewsItem[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    // Fetch public news in parallel — doesn't need auth
    getDocs(query(collection(db, "newsItems"), limit(3)))
      .then(snap => setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem))))
      .catch(() => {});

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/onboarding");
        return;
      }

      try {
        // ── User profile ──
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists() || !userSnap.data()?.onboarding_complete) {
          router.push("/onboarding");
          return;
        }

        const userData = userSnap.data();
        setUserName(userData.name ?? "");

        if (userData.zone_id) {
          const zone = ZONES.find(z => z.id === userData.zone_id);
          if (zone) setUserZoneName(zone.en);

          // ── Active outages in user's zone ──
          const outageSnap = await getDocs(
            query(
              collection(db, "outages"),
              where("zone_id", "==", userData.zone_id),
              where("status", "==", "active"),
              limit(1)
            )
          );
          setHasOutage(!outageSnap.empty);
        }

        // ── Latest bill ──
        const billSnap = await getDocs(
          query(
            collection(db, "bills"),
            where("user_id", "==", user.uid),
            orderBy("created_at", "desc"),
            limit(1)
          )
        );
        if (!billSnap.empty) {
          setHasBill(true);
          setBillData(billSnap.docs[0].data() as BillData);
        }

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // ── Derived values ──
  const potentialSavings = billData?.tips_json?.reduce(
    (acc, tip) => acc + (tip.estimated_saving_max_rs ?? 0), 0
  ) ?? 0;

  const chargeTotal =
    (billData?.energy_charges       ?? 0) +
    (billData?.fuel_cost_adjustment ?? 0) +
    (billData?.fixed_charges        ?? 0) +
    (billData?.gst                  ?? 0);

  const chargePct = (v: number) =>
    chargeTotal > 0 ? `${((v / chargeTotal) * 100).toFixed(1)}%` : "0%";

  const delta       = billData?.benchmark_json?.delta_pct ?? null;
  const isAboveAvg  = delta !== null && delta > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <main className="px-4 pb-[140px] pt-4 flex flex-col space-y-5 max-w-2xl mx-auto w-full">

        {/* ── Top bar ── */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-[20px] font-bold text-[var(--amber)] tracking-tight leading-none">
              WattHai
            </h1>
            {userName && (
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Hello, {userName}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <Bell width={20} height={20} />
            </button>
            <LanguageToggle />
          </div>
        </div>

        {/* ── Latest Bill ── */}
        <section>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_bill")}
          </p>

          {!hasBill ? (
            <Link
              href="/scan"
              className="flex flex-col items-center justify-center w-full border-2 border-dashed border-[var(--bg-border)] rounded p-8 text-center hover:bg-[var(--bg-surface)] transition-colors group"
            >
              <div className="w-10 h-10 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded flex items-center justify-center mb-3 group-hover:border-[var(--amber)] transition-colors">
                <ScanLine width={18} height={18} className="text-[var(--text-muted)] group-hover:text-[var(--amber)]" />
              </div>
              <span className="text-[15px] font-medium text-[var(--amber)]">
                Scan your first bill →
              </span>
              <span className="text-[12px] text-[var(--text-muted)] mt-1">
                Takes less than 30 seconds
              </span>
            </Link>
          ) : (
            <div
              onClick={() => router.push("/bills")}
              className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded p-4 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
            >
              {/* Month + due date */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] text-[var(--text-muted)]">
                  {billData?.billing_month ?? "Current Month"}
                </span>
                {billData?.due_date && (
                  <span className="font-mono text-[11px] bg-[#450A0A] text-[var(--red-alert)] px-1.5 py-0.5 rounded-sm">
                    Due {billData.due_date}
                  </span>
                )}
              </div>

              {/* Total */}
              <div className="text-[34px] font-mono text-[var(--text-primary)] leading-none mb-1">
                Rs. {billData?.total_payable?.toLocaleString() ?? 0}
              </div>

              {/* Units + benchmark badge */}
              <div className="flex items-center space-x-2 mb-4">
                <span className="font-mono text-[13px] text-[var(--text-secondary)]">
                  {billData?.units_consumed?.toLocaleString() ?? 0} units
                </span>
                {delta !== null && (
                  <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded-sm ${
                    isAboveAvg
                      ? "bg-[#451A03] text-[var(--amber)]"
                      : "bg-[#042F2E] text-[var(--teal)]"
                  }`}>
                    {isAboveAvg ? "↑" : "↓"} {Math.abs(delta)}% vs zone avg
                  </span>
                )}
              </div>

              {/* Charge breakdown bar */}
              <div className="flex w-full h-[8px] overflow-hidden mb-3">
                <div className="bg-[var(--amber)]"
                  style={{ width: chargePct(billData?.energy_charges ?? 0) }} />
                <div className="bg-[var(--teal)]"
                  style={{ width: chargePct(billData?.fuel_cost_adjustment ?? 0) }} />
                <div className="bg-[#6366F1]"
                  style={{ width: chargePct(billData?.fixed_charges ?? 0) }} />
                <div className="bg-[#64748B]"
                  style={{ width: chargePct(billData?.gst ?? 0) }} />
              </div>

              {/* Bar legend */}
              <div className="flex items-center space-x-3 text-[10px] font-mono text-[var(--text-muted)]">
                {[
                  { color: "bg-[var(--amber)]", label: "Energy" },
                  { color: "bg-[var(--teal)]",  label: "FCA"    },
                  { color: "bg-[#6366F1]",       label: "Fixed"  },
                  { color: "bg-[#64748B]",        label: "Tax"    },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center space-x-1">
                    <span className={`w-2 h-2 ${color} inline-block`} />
                    <span>{label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Potential Savings ── */}
        <section>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_savings")}
          </p>
          <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded p-4">
            {potentialSavings > 0 ? (
              <>
                <div className="text-[34px] font-mono text-[var(--teal)] leading-none mb-1">
                  Rs. {potentialSavings.toLocaleString()}
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Estimated monthly savings from your last analysis
                </p>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded flex items-center justify-center">
                  <Zap width={14} height={14} className="text-[var(--text-muted)]" />
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Scan a bill and select your appliances to see savings
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Neighborhood Power Status ── */}
        <section>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_outages")}
          </p>
          <div
            onClick={() => router.push("/community")}
            className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded p-4 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-[var(--text-secondary)]">
                {userZoneName || "Your Area"}
              </span>
              <div className="flex items-center space-x-2">
                {!hasOutage ? (
                  <span className="font-mono text-[11px] bg-[#042F2E] text-[var(--teal)] px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)] inline-block" />
                    ALL CLEAR
                  </span>
                ) : (
                  <span className="font-mono text-[11px] bg-[#450A0A] text-[var(--red-alert)] px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--red-alert)] inline-block animate-pulse" />
                    OUTAGE ACTIVE
                  </span>
                )}
                <ChevronRight
                  width={14}
                  height={14}
                  className="text-[var(--text-muted)] group-hover:text-[var(--amber)] transition-colors"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── News ── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
              {t("section_news")}
            </p>
            <Link
              href="/news"
              className="text-[12px] text-[var(--amber)] hover:underline"
            >
              View all →
            </Link>
          </div>

          {news.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[13px] text-[var(--text-muted)]">
                No news yet —{" "}
                <Link href="/api/fetch-news" className="text-[var(--amber)] underline">
                  fetch now
                </Link>
              </p>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded divide-y divide-[var(--bg-border)]">
              {news.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-start justify-between group cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="flex-1 pr-3">
                    <p className="text-[14px] text-[var(--text-primary)] font-medium leading-snug group-hover:text-[var(--amber)] transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                      {item.source}
                      {item.publishedAt && (
                        <> · {new Date(item.publishedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <ChevronRight
                    width={14}
                    height={14}
                    className="text-[var(--text-muted)] mt-0.5 shrink-0"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* ── Sticky Scan Button above bottom nav ── */}
      <div className="fixed bottom-[64px] left-0 right-0 z-40 px-4 pb-3 bg-gradient-to-t from-[var(--bg-base)] to-transparent pt-4 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <Link
            href="/scan"
            className="flex items-center justify-center w-full h-[48px] bg-[var(--amber)] text-[#0C0C0C] rounded font-bold text-[13px] tracking-[0.06em] uppercase hover:bg-[#D97706] active:bg-[#B45309] transition-colors"
          >
            <ScanLine width={18} height={18} className="mr-2" />
            {t("btn_scan")}
          </Link>
        </div>
      </div>

      <BottomNav />
    </>
  );
}