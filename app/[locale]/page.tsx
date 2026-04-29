"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Bell, ScanLine, ChevronRight } from "lucide-react";
import { BottomNav } from "@/components/shared/BottomNav";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

export default function Dashboard() {
  const t = useTranslations("dashboard");
  const tNews = useTranslations("news");
  const router = useRouter();

  const [hasBill, setHasBill] = useState(false);
  const [billData, setBillData] = useState<any>(null);
  const [hasOutage, setHasOutage] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        // Fetch news
        const newsSnap = await getDocs(query(collection(db, "newsItems"), limit(3)));
        const newsList = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (newsList.length > 0) setNews(newsList);
        else {
          // Fallback if empty database
          setNews([
              { id: 1, title: "NEPRA okays Rs2.75 per unit FCA for Karachi", source: "DAWN", time: "2h ago" },
              { id: 2, title: "K-Electric announces summer load-shedding schedule", source: "GEO", time: "5h ago" }
          ]);
        }
      } catch (e) {
        console.error("Public data error", e);
      }
    };
    fetchPublicData();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch latest bill
          const billsQ = query(collection(db, "bills"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(1));
          const billsSnap = await getDocs(billsQ);
          if (!billsSnap.empty) {
            setHasBill(true);
            setBillData(billsSnap.docs[0].data());
          } else {
            setHasBill(false);
          }

          // Fetch user profile to get zone_id
          const userSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid)));
          if (!userSnap.empty) {
             const userData = userSnap.docs[0].data();
             if (userData.zone_id) {
                 const outageQ = query(collection(db, "outages"), where("zone_id", "==", userData.zone_id), where("status", "==", "active"), limit(1));
                 const outageSnap = await getDocs(outageQ);
                 setHasOutage(!outageSnap.empty);
             }
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      } else {
        // Redirect to onboarding if not signed in
        router.push("/onboarding");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center p-4">Loading...</div>;

  return (
    <>
      <main className="px-4 pb-[88px] md:pb-8 pt-4 flex flex-col space-y-6 max-w-7xl mx-auto w-full">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[20px] font-bold text-[var(--amber)] font-sans tracking-tight">
            WattHai
          </h1>
          <div className="flex items-center space-x-3">
            <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <Bell width={20} height={20} />
            </button>
            <LanguageToggle />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-6 col-span-1 lg:col-span-2">
            {/* Latest Bill */}
            <section>
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_bill")}
          </h2>
          {!hasBill ? (
            <Link
              href="/scan"
              className="block w-full border-2 border-dashed border-[var(--bg-border)] rounded-md p-6 text-center hover:bg-[var(--bg-surface)] transition-colors"
            >
              <span className="text-[var(--amber)] font-medium">
                {t("no_bill")} &rarr;
              </span>
            </Link>
          ) : (
            <div
              onClick={() => router.push("/history")}
              className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-md p-4 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {billData?.billing_month || 'Current Month'}
                </span>
                <span className="font-mono text-[11px] font-medium bg-[var(--red-dim)] text-[var(--red-alert)] px-1.5 py-0.5 rounded-sm">
                  {billData?.due_date ? new Date(billData.due_date).toLocaleDateString() : 'Due Soon'}
                </span>
              </div>
              <div className="text-[34px] font-mono text-[var(--text-primary)] leading-none mb-1">
                Rs. {billData?.total_payable || 0}
              </div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="font-mono text-[13px] text-[var(--text-secondary)]">
                  {billData?.units_consumed || 0} units
                </span>
                {billData?.benchmark_json && (
                   <span className="font-mono text-[11px] font-medium bg-[#451A03] text-[var(--amber)] px-1.5 py-0.5 rounded-sm">
                     {t("above_avg", { pct: billData.benchmark_json.delta_pct || 0 })}
                   </span>
                )}
              </div>
              {/* Stacked bar */}
              <div className="flex w-full h-[6px] rounded-none overflow-hidden">
                <div className="bg-[var(--amber)]" style={{ width: "50%" }} />
                <div className="bg-[var(--teal)]" style={{ width: "25%" }} />
                <div className="bg-[#6366F1]" style={{ width: "15%" }} />
                <div className="bg-[#64748B]" style={{ width: "10%" }} />
              </div>
            </div>
          )}
        </section>

        {/* Potential Savings */}
        <section>
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_savings")}
          </h2>
          <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-md p-4">
            <div className="text-[34px] font-mono text-[var(--teal)] leading-none mb-1">
              Rs. {billData?.tips_json?.reduce((acc: number, t: any) => acc + (t.estimated_saving_max_rs || 0), 0) || 0}
            </div>
            <div className="text-[13px] text-[var(--text-muted)]">
              Based on your last bill analysis
            </div>
          </div>
            </section>
          </div>
          
          <div className="space-y-6 col-span-1">
            {/* Neighborhood Power Status */}
        <section>
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_outages")}
          </h2>
          <div
            className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-md p-4 relative group cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
            onClick={() => router.push("/community")}
          >
            <div className="flex justify-between items-center">
              <span className="text-[15px] text-[var(--text-secondary)]">
                Gulistan-e-Johar
              </span>
              {!hasOutage ? (
                <span className="font-mono text-[11px] font-medium bg-[#042F2E] text-[var(--teal)] px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)] inline-block" />
                  {t("all_clear").toUpperCase()}
                </span>
              ) : (
                <span className="font-mono text-[11px] font-medium bg-[#450A0A] text-[var(--red-alert)] px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--red-alert)] inline-block animate-pulse" />
                  {t("outages_active", { count: 2 }).toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute bottom-4 right-4 text-[13px] text-[var(--amber)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              See Community <ChevronRight width={14} height={14} />
            </div>
          </div>
        </section>

        {/* News */}
        <section>
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            {t("section_news")}
          </h2>
          <div className="space-y-0">
            {news.map((item, idx) => (
              <div
                key={item.id}
                className={`py-3 flex flex-col cursor-pointer group ${idx !== 0 ? "border-t border-[var(--bg-border)]" : ""}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-[15px] text-[var(--text-primary)] font-medium leading-tight group-hover:text-[var(--amber)] transition-colors pr-4">
                    {item.title}
                  </h3>
                  <ChevronRight
                    width={16}
                    height={16}
                    className="text-[var(--text-muted)] mt-0.5"
                  />
                </div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                  {item.source} • {item.time || "Recent"}
                </div>
              </div>
            ))}
            <Link
              href="/news"
              className="inline-block mt-4 text-[13px] text-[var(--amber)] hover:underline"
            >
              View all &rarr;
            </Link>
          </div>
        </section>
          </div>
        </div>
      </main>

      {/* FAB Replacement Scan Bar */}
      <div className="fixed bottom-[64px] md:bottom-6 md:right-6 md:left-auto right-0 left-0 z-40 px-4 md:px-0 pb-4 md:pb-0 pointer-events-none drop-shadow-xl">
        <div className="mx-auto w-full max-w-sm pointer-events-auto">
          <Link
            href="/scan"
            className="flex items-center justify-center w-full h-[48px] bg-[var(--amber)] text-[#0C0C0C] rounded-md font-bold text-[13px] tracking-[0.06em] uppercase hover:bg-[#D97706] transition-colors shadow-lg shadow-black/50"
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
