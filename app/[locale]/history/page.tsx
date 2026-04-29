"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function HistoryPage() {
  const t = useTranslations("history");
  const [bills, setBills] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
         try {
           const billsQ = query(collection(db, "bills"), where("user_id", "==", user.uid), orderBy("billing_month", "desc"));
           const snap = await getDocs(billsQ);
           const fetchedBills = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           setBills(fetchedBills);
           
           // Format for chart (reverse chron)
           const chartData = fetchedBills.slice(0, 6).reverse().map(b => ({
             month: b.billing_month || "Unknown",
             units: b.units_consumed || 0
           }));
           setData(chartData);
         } catch(e) {
           console.error("error history fields", e);
         }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <main className="px-4 pb-[88px] pt-4 flex flex-col min-h-screen">
      <h1 className="text-[20px] font-bold text-[var(--text-primary)] font-sans tracking-tight mb-6 mt-1">
        {t("header").toUpperCase()}
      </h1>

      <section className="mb-8">
        <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
          {t("section_trend")}
        </h2>

        <div className="h-[200px] w-full ml-[-16px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--bg-border)"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 11,
                  fill: "var(--text-secondary)",
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 11,
                  fill: "var(--text-secondary)",
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: "4px",
                  padding: "8px",
                }}
                itemStyle={{
                  color: "var(--amber)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
                labelStyle={{
                  color: "var(--text-secondary)",
                  fontSize: "11px",
                  marginBottom: "4px",
                }}
                cursor={{ stroke: "var(--bg-border)" }}
              />
              <Line
                type="monotone"
                dataKey="units"
                stroke="var(--amber)"
                strokeWidth={2}
                dot={{
                  r: 4,
                  fill: "var(--bg-base)",
                  stroke: "var(--amber)",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 6, fill: "var(--amber)" }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
          {t("section_bills")}
        </h2>

        <div className="space-y-0 border-t border-[var(--bg-border)]">
          {bills.map((bill, idx: number) => {
            let trend = "ok";
            if (idx < bills.length - 1) {
              const prev = bills[idx + 1].units_consumed || 0;
              const curr = bill.units_consumed || 0;
              if (curr > prev) trend = "up";
              else if (curr < prev) trend = "down";
            }
            return (
            <div
              key={bill.id || idx}
              className="flex justify-between items-center py-4 border-b border-[var(--bg-border)] group cursor-pointer hover:bg-[var(--bg-surface)] px-1 -mx-1 transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-[15px] font-medium text-[var(--text-primary)] leading-none mb-1 group-hover:text-[var(--amber)] transition-colors">
                  {bill.billing_month || "Unknown"}
                </span>
                <span className="font-mono text-[13px] text-[var(--text-secondary)]">
                  {bill.units_consumed || 0} {t("units_label")}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[15px] font-medium text-[var(--text-primary)] leading-none mb-1">
                  Rs. {bill.total_payable || 0}
                </span>
                <span
                  className={`font-mono text-[11px] font-medium px-1.5 py-0.5 rounded-sm ${
                    trend === "up"
                      ? "bg-[#451A03] text-[var(--amber)]"
                      : trend === "down"
                        ? "bg-[#042F2E] text-[var(--teal)]"
                        : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                  }`}
                >
                  {trend === "up" ? "+" : trend === "down" ? "-" : ""}{trend === "up" || trend === "down" ? "..." : "..."}
                </span>
              </div>
            </div>
          );})}
        </div>
      </section>
    </main>
  );
}
