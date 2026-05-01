"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, query, where, onSnapshot,
  doc, getDoc, addDoc, updateDoc,
  orderBy, Timestamp,
} from "firebase/firestore";
import { BottomNav } from "@/components/shared/BottomNav";
import { ZONES } from "@/lib/config";
import {
  Zap, ZapOff, CheckCircle, Clock,
  AlertTriangle, Users, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Outage {
  id:           string;
  zone_id:      string;
  zone_name?:   string;
  status:       "active" | "resolving" | "restored";
  report_count: number;
  started_at:   string;
  resolved_at?: string;
  fcm_sent?:    boolean;
}

interface RestorationPoll {
  outage_id: string;
  user_id:   string;
  response:  "yes" | "no";
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function zoneName(zoneId: string): string {
  return ZONES.find(z => z.id === zoneId)?.en ?? zoneId;
}

// ─── Outage Card ──────────────────────────────────────────────────────────────

function OutageCard({
  outage,
  isUserZone,
  userId,
  onPollSubmit,
}: {
  outage:       Outage;
  isUserZone:   boolean;
  userId:       string;
  onPollSubmit: (outageId: string, response: "yes" | "no") => void;
}) {
  const [pollSubmitted, setPollSubmitted] = useState(false);

  const handlePoll = (response: "yes" | "no") => {
    setPollSubmitted(true);
    onPollSubmit(outage.id, response);
  };

  const isActive   = outage.status === "active";
  const isRestored = outage.status === "restored";

  return (
    <div className={`rounded border p-4 transition-colors ${
      isActive
        ? "bg-[#0F0808] border-[var(--red-alert)]"
        : "bg-[#080F0E] border-[var(--teal)]"
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isActive ? (
            <ZapOff width={16} height={16} className="text-[var(--red-alert)] shrink-0" />
          ) : (
            <CheckCircle width={16} height={16} className="text-[var(--teal)] shrink-0" />
          )}
          <div>
            <p className={`text-[15px] font-semibold ${
              isActive ? "text-[var(--red-alert)]" : "text-[var(--teal)]"
            }`}>
              {zoneName(outage.zone_id)}
              {isUserZone && (
                <span className="ml-2 text-[10px] font-mono bg-[var(--bg-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-sm">
                  YOUR AREA
                </span>
              )}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {isActive ? "Power cut" : "Power restored"} · {timeAgo(outage.started_at)}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`font-mono text-[10px] px-2 py-1 rounded-sm flex items-center gap-1 ${
          isActive
            ? "bg-[#450A0A] text-[var(--red-alert)]"
            : "bg-[#042F2E] text-[var(--teal)]"
        }`}>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--red-alert)] inline-block animate-pulse" />
          )}
          {isActive ? "ACTIVE" : "RESTORED"}
        </span>
      </div>

      {/* Report count */}
      <div className="flex items-center space-x-1 mb-3">
        <Users width={12} height={12} className="text-[var(--text-muted)]" />
        <span className="text-[12px] font-mono text-[var(--text-muted)]">
          {outage.report_count} neighbor{outage.report_count !== 1 ? "s" : ""} reported
        </span>
      </div>

      {/* Restoration poll — shown for active outages older than 30 mins */}
      {isActive && isUserZone && !pollSubmitted && (() => {
        const ageMs = Date.now() - new Date(outage.started_at).getTime();
        const show  = ageMs > 10 * 60 * 1000; // show after 10 mins for demo
        return show ? (
          <div className="border-t border-[var(--bg-border)] pt-3 mt-1">
            <p className="text-[13px] text-[var(--text-secondary)] mb-2">
              Has power returned in your area?
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePoll("yes")}
                className="flex-1 py-2 bg-[var(--teal)] text-[#0C0C0C] font-bold rounded text-[13px] hover:opacity-90 transition-opacity"
              >
                ✓ Yes
              </button>
              <button
                onClick={() => handlePoll("no")}
                className="flex-1 py-2 bg-transparent border border-[var(--bg-border)] text-[var(--text-primary)] font-semibold rounded text-[13px] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                ✗ No
              </button>
            </div>
          </div>
        ) : null;
      })()}

      {/* Poll submitted confirmation */}
      {pollSubmitted && (
        <div className="border-t border-[var(--bg-border)] pt-3 mt-1">
          <p className="text-[13px] text-[var(--teal)] flex items-center space-x-1">
            <CheckCircle width={14} height={14} />
            <span>Thanks — your neighbors have been updated</span>
          </p>
        </div>
      )}

      {/* Resolved time */}
      {isRestored && outage.resolved_at && (
        <div className="border-t border-[var(--bg-border)] pt-3 mt-1">
          <p className="text-[12px] text-[var(--text-muted)]">
            Restored {timeAgo(outage.resolved_at)} · outage lasted{" "}
            {Math.round(
              (new Date(outage.resolved_at).getTime() -
                new Date(outage.started_at).getTime()) / 60000
            )}{" "}
            mins
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const router = useRouter();

  const [userId, setUserId]         = useState<string | null>(null);
  const [userZoneId, setUserZoneId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [reporting, setReporting]   = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError]     = useState<string | null>(null);

  const [myZoneOutages, setMyZoneOutages]     = useState<Outage[]>([]);
  const [otherOutages, setOtherOutages]       = useState<Outage[]>([]);
  const [showOtherAreas, setShowOtherAreas]   = useState(false);

  // ── Auth + user profile ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/onboarding"); return; }
      setUserId(user.uid);

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setUserZoneId(snap.data()?.zone_id ?? null);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  // ── Real-time outage listener ──
  useEffect(() => {
    if (!userZoneId) return;

    // Listen to all active/recently restored outages
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const q = query(
      collection(db, "outages"),
      where("started_at", ">=", cutoff),
      orderBy("started_at", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const all: Outage[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as Outage));

      setMyZoneOutages(all.filter(o => o.zone_id === userZoneId));
      setOtherOutages(all.filter(o => o.zone_id !== userZoneId));
    });

    return () => unsub();
  }, [userZoneId]);

  // ── Report outage ──
  const handleReportOutage = async () => {
    if (!userId || !userZoneId) return;
    setReporting(true);
    setReportError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/report-outage", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ zone_id: userZoneId }),
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to report");
    if (data.already_reported) {
      setReportError("You've already reported this outage. Thanks for confirming.");
    } else {
      setReportSuccess(true);
      setTimeout(() => setReportSuccess(false), 4000);
    }
  } catch (err: any) {
    setReportError(err.message);
  } finally {
    setReporting(false);
  }
};
  

  // ── Submit restoration poll ──
  const handlePollSubmit = async (outageId: string, response: "yes" | "no") => {
    if (!userId) return;
    try {
      await addDoc(collection(db, "restorationPolls"), {
        outage_id:  outageId,
        user_id:    userId,
        response,
        created_at: new Date().toISOString(),
      });

      // If enough yes votes, trigger check
      if (response === "yes") {
        await fetch("/api/restoration-poll-check", {
          headers: { Authorization: "Bearer TEST_MODE" },
        });
      }
    } catch (err) {
      console.error("Poll submit error:", err);
    }
  };

  const myZoneName   = userZoneId ? zoneName(userZoneId) : "Your Area";
  const activeInZone = myZoneOutages.filter(o => o.status === "active");
  const hasActive    = activeInZone.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <main className="px-4 pt-4 pb-[88px] max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
            NEIGHBORHOOD
          </p>
          <h1 className="text-[26px] font-bold text-[var(--text-primary)]">
            {myZoneName}
          </h1>
        </div>

        {/* Zone status banner */}
        <div className={`rounded p-4 mb-5 flex items-center justify-between ${
          hasActive
            ? "bg-[#0F0808] border border-[var(--red-alert)]"
            : "bg-[#080F0E] border border-[var(--teal)]"
        }`}>
          <div className="flex items-center space-x-3">
            {hasActive ? (
              <ZapOff width={20} height={20} className="text-[var(--red-alert)]" />
            ) : (
              <Zap width={20} height={20} className="text-[var(--teal)]" />
            )}
            <div>
              <p className={`text-[15px] font-semibold ${
                hasActive ? "text-[var(--red-alert)]" : "text-[var(--teal)]"
              }`}>
                {hasActive ? `${activeInZone.length} outage active` : "All clear"}
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                {hasActive
                  ? `${activeInZone[0].report_count} neighbors reported`
                  : "No reported outages in your area"}
              </p>
            </div>
          </div>

          {hasActive && (
            <span className="font-mono text-[10px] bg-[#450A0A] text-[var(--red-alert)] px-2 py-1 rounded-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--red-alert)] animate-pulse inline-block" />
              LIVE
            </span>
          )}
        </div>

        {/* My zone outages */}
        {myZoneOutages.length > 0 && (
          <section className="mb-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
              YOUR AREA — {myZoneName.toUpperCase()}
            </p>
            <div className="space-y-3">
              {myZoneOutages.map(outage => (
                <OutageCard
                  key={outage.id}
                  outage={outage}
                  isUserZone={true}
                  userId={userId!}
                  onPollSubmit={handlePollSubmit}
                />
              ))}
            </div>
          </section>
        )}

        {/* Report button */}
        <section className="mb-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            REPORT AN OUTAGE
          </p>
          <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded p-4">
            <p className="text-[14px] text-[var(--text-secondary)] mb-4">
              Is power out in {myZoneName}? Let your neighbors know.
            </p>

            {reportSuccess ? (
              <div className="flex items-center space-x-2 py-3 text-[var(--teal)]">
                <CheckCircle width={16} height={16} />
                <span className="text-[14px] font-medium">
                  Reported — your neighbors have been notified
                </span>
              </div>
            ) : (
              <button
                onClick={handleReportOutage}
                disabled={reporting}
                className="w-full py-3 bg-[var(--red-alert)] text-white font-bold rounded text-[14px] hover:bg-[#DC2626] active:bg-[#B91C1C] transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <ZapOff width={16} height={16} />
                <span>{reporting ? "Reporting..." : "Power is out in my area"}</span>
              </button>
            )}

            {reportError && (
              <div className="mt-3 flex items-center space-x-2 text-[var(--red-alert)]">
                <AlertTriangle width={14} height={14} />
                <span className="text-[13px]">{reportError}</span>
              </div>
            )}
          </div>
        </section>

        {/* How it works */}
        <section className="mb-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
            HOW IT WORKS
          </p>
          <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded divide-y divide-[var(--bg-border)]">
            {[
              {
                icon: Users,
                title: "10 reports triggers an alert",
                desc:  "When 10 neighbors report an outage, everyone in the area gets notified.",
              },
              {
                icon: Clock,
                title: "Restoration polling",
                desc:  "After 30 minutes, we ask if power has returned. Majority yes = marked restored.",
              },
              {
                icon: CheckCircle,
                title: "Automatic resolution",
                desc:  "Once 60% confirm power is back, the outage is marked resolved.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start space-x-3 p-3">
                <Icon width={15} height={15} className="text-[var(--amber)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{title}</p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Other areas — collapsible */}
        {otherOutages.length > 0 && (
          <section>
            <button
              onClick={() => setShowOtherAreas(v => !v)}
              className="flex items-center justify-between w-full mb-2"
            >
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
                OTHER AREAS ({otherOutages.length})
              </p>
              {showOtherAreas
                ? <ChevronUp width={14} height={14} className="text-[var(--text-muted)]" />
                : <ChevronDown width={14} height={14} className="text-[var(--text-muted)]" />
              }
            </button>

            {showOtherAreas && (
              <div className="space-y-3">
                {otherOutages.map(outage => (
                  <OutageCard
                    key={outage.id}
                    outage={outage}
                    isUserZone={false}
                    userId={userId!}
                    onPollSubmit={handlePollSubmit}
                  />
                ))}
              </div>
            )}
          </section>
        )}

      </main>
      <BottomNav />
    </>
  );
}