"use client";

import { useTranslations } from "next-intl";
import { ZapOff, CheckCircle, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, limit, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CommunityPage() {
  const t = useTranslations("community");
  const [hasOutage, setHasOutage] = useState(false);
  const [outageDoc, setOutageDoc] = useState<any>(null);
  const [zone, setZone] = useState<string>("Unknown Zone");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid)));
          if (!userSnap.empty) {
             const userData = userSnap.docs[0].data();
             const zoneId = userData.zone_id || "Unknown Zone";
             setZone(zoneId);

             const outageQ = query(collection(db, "outages"), where("zone_id", "==", zoneId), where("status", "==", "active"), limit(1));
             const outageSnap = await getDocs(outageQ);
             if (!outageSnap.empty) {
                setOutageDoc({ id: outageSnap.docs[0].id, ...outageSnap.docs[0].data() });
                setHasOutage(true);
             }
          }
        } catch (e) {
           console.error("Community fetch error", e);
        }
      } else {
        router.push("/onboarding");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleVote = async (response: "yes" | "no") => {
    if (!auth.currentUser || !outageDoc) return;
    try {
      await addDoc(collection(db, "restorationPolls"), {
        outage_id: outageDoc.id,
        user_id: auth.currentUser.uid,
        response,
        created_at: new Date().toISOString()
      });
      alert(t("poll_thanks"));
    } catch (e) {
      console.error("Vote error", e);
    }
  };

  const handleReport = async () => {
    if (!auth.currentUser) return;
    try {
      const res = await fetch("/api/report-outage", {
        method: "POST",
        headers: {
           "Content-Type": "application/json",
           "Authorization": `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({ zone_id: zone })
      });
      if (res.ok) {
         alert("Outage reported successfully.");
         window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <main className="px-4 pb-[88px] pt-4 flex flex-col space-y-6">
      <div className="flex items-center space-x-2 mb-2">
        <h1 className="text-[20px] font-bold text-[var(--text-primary)] font-sans tracking-tight">
          {t("header").toUpperCase()}
        </h1>
        <span className="font-mono text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--bg-border)] px-2 py-0.5 rounded-sm uppercase tracking-wider text-[var(--amber)]">
          {zone}
        </span>
      </div>

      <section>
        {!hasOutage ? (
          <div className="bg-[var(--bg-surface)] border-l-4 border-l-[#4ADE80] border border-[var(--bg-border)] rounded-md p-4 flex items-center">
            <CheckCircle
              width={20}
              height={20}
              className="text-[#4ADE80] mr-3"
            />
            <div className="flex flex-col">
              <span className="text-[15px] font-medium">
                {t("all_clear_label", { zone })}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                Checked just now
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-[var(--bg-surface)] border-l-4 border-l-[var(--red-alert)] border border-[var(--bg-border)] rounded-md p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                  <Zap
                    width={16}
                    height={16}
                    className="text-[var(--red-alert)] mr-2"
                  />
                  <div>
                    <span className="font-bold text-[15px] block">
                      {zone}
                    </span>
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      {t("outage_label")}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-medium bg-[#450A0A] text-[var(--red-alert)] px-1.5 py-0.5 rounded-sm uppercase">
                  {t("status_active")}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] mb-4">
                <div className="flex space-x-4">
                  <span className="font-mono text-[var(--text-primary)]">
                    <span className="text-[var(--text-muted)]">
                      {t("started")}
                    </span>{" "}
                    {outageDoc ? new Date(outageDoc.started_at).toLocaleTimeString() : "Unknown"}
                  </span>
                </div>
                <span className="text-[var(--text-secondary)]">
                  {t("neighbors_reported", { count: outageDoc?.report_count || 1 })}
                </span>
              </div>

              {/* Poll */}
              <div className="bg-[var(--bg-elevated)] p-3 rounded border border-[var(--bg-border)]">
                <p className="text-[13px] font-medium mb-3">
                  {t("poll_question")}
                </p>
                <div className="flex space-x-2">
                  <button onClick={() => handleVote("yes")} className="flex-1 py-1.5 bg-[var(--amber)] text-[#0C0C0C] font-semibold text-[13px] rounded hover:bg-[#D97706] transition-colors flex items-center justify-center">
                    {t("btn_yes")} ✓
                  </button>
                  <button onClick={() => handleVote("no")} className="flex-1 py-1.5 bg-transparent border border-[var(--bg-border)] text-[var(--text-primary)] font-semibold text-[13px] rounded hover:bg-[var(--bg-surface)] transition-colors flex items-center justify-center">
                    {t("btn_no")} ✗
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Report Button */}
      <button onClick={handleReport} className="w-full bg-[var(--bg-surface)] border-2 border-dashed border-[var(--bg-border)] rounded-md p-4 flex flex-col items-center justify-center hover:bg-[var(--bg-elevated)] transition-colors group">
        <ZapOff width={24} height={24} className="text-[var(--amber)] mb-2" />
        <span className="text-[15px] font-medium mb-2 group-hover:text-[var(--amber)] transition-colors text-[var(--text-secondary)]">
          Power out in your area?
        </span>
        <span className="bg-[var(--amber)] text-[#0C0C0C] font-bold text-[13px] py-2 px-6 rounded">
          {t("btn_report")}
        </span>
      </button>

      {/* Other Areas */}
      <section className="pt-2">
        <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
          {t("other_areas")}
        </h2>
        <div className="space-y-0 border-t border-[var(--bg-border)]">
          {[
            { zone: "Defence", status: "ok" },
            { zone: "Nazimabad", status: "outage" },
            { zone: "Clifton", status: "resolving" },
          ].map((area, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center py-3 border-b border-[var(--bg-border)] px-1"
            >
              <span className="text-[15px] text-[var(--text-secondary)]">
                {area.zone}
              </span>
              {area.status === "ok" && (
                <span className="font-mono text-[11px] text-[var(--teal)] font-medium">
                  ALL CLEAR
                </span>
              )}
              {area.status === "outage" && (
                <span className="font-mono text-[11px] text-[var(--red-alert)] font-medium">
                  OUTAGE
                </span>
              )}
              {area.status === "resolving" && (
                <span className="font-mono text-[11px] text-[#FCD34D] font-medium">
                  RESOLVING
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
