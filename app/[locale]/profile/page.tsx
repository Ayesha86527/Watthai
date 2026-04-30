"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { BottomNav } from "@/components/shared/BottomNav";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ZONES } from "@/lib/config";
import {
  User, MapPin, Home, Thermometer,
  Bell, LogOut, ChevronRight, CheckCircle
} from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
  zone_id: string;
  society_name: string;
  persons_in_house: number;
  rooms: number;
  ac_count: number;
  has_inverter: boolean;
  has_geyser: boolean;
  has_washing_machine: boolean;
  has_water_pump: boolean;
  alert_opt_in: boolean;
  language: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2 mt-6">
      {children}
    </p>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--bg-border)] last:border-0">
      <div className="flex items-center space-x-3">
        <Icon width={16} height={16} className="text-[var(--text-muted)]" />
        <span className="text-[14px] text-[var(--text-muted)]">{label}</span>
      </div>
      <span className="text-[14px] text-[var(--text-primary)] font-medium">
        {value}
      </span>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between py-3 border-b border-[var(--bg-border)] last:border-0 cursor-pointer"
    >
      <span className="text-[14px] text-[var(--text-primary)]">{label}</span>
      <div
        className={`w-10 h-6 rounded-full transition-colors relative ${
          checked ? "bg-[var(--amber)]" : "bg-[var(--bg-border)]"
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
            checked ? "left-5" : "left-1"
          }`}
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [userId, setUserId]     = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/onboarding"); return; }
      setUserId(user.uid);

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setProfile({
            ...snap.data() as UserProfile,
            email: user.email ?? "",
          });
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const updateField = async (field: keyof UserProfile, value: any) => {
    if (!userId || !profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", userId), { [field]: value });
      setProfile(prev => prev ? { ...prev, [field]: value } : prev);
    } catch (err) {
      console.error("Update error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/onboarding");
  };

  const zoneName = profile?.zone_id
    ? ZONES.find(z => z.id === profile.zone_id)?.en ?? profile.zone_id
    : "Not set";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <main className="px-4 pt-4 pb-[88px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
              YOUR PROFILE
            </p>
            <h1 className="text-[26px] font-bold text-[var(--text-primary)]">
              {profile?.name ?? "Profile"}
            </h1>
            <p className="text-[13px] text-[var(--text-muted)]">{profile?.email}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[var(--amber)] flex items-center justify-center">
            <span className="text-[#0C0C0C] font-bold text-[18px]">
              {profile?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        </div>

        {/* Location */}
        <SectionLabel>Location</SectionLabel>
        <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded px-4">
          <InfoRow icon={MapPin} label="Zone"    value={zoneName} />
          <InfoRow icon={Home}   label="Society" value={profile?.society_name || "Not set"} />
        </div>

        {/* Household */}
        <SectionLabel>Household</SectionLabel>
        <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded px-4">
          <InfoRow icon={User}        label="People"  value={String(profile?.persons_in_house ?? "—")} />
          <InfoRow icon={Home}        label="Rooms"   value={String(profile?.rooms ?? "—")} />
          <InfoRow icon={Thermometer} label="ACs"     value={String(profile?.ac_count ?? "—")} />
        </div>

        {/* Appliances */}
        <SectionLabel>Appliances</SectionLabel>
        <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded px-4">
          {[
            { label: "Inverter / UPS",    field: "has_inverter"         as keyof UserProfile },
            { label: "Geyser",            field: "has_geyser"           as keyof UserProfile },
            { label: "Washing Machine",   field: "has_washing_machine"  as keyof UserProfile },
            { label: "Water Pump",        field: "has_water_pump"       as keyof UserProfile },
          ].map(({ label, field }) => (
            <ToggleRow
              key={field}
              label={label}
              checked={!!profile?.[field]}
              onChange={(v) => updateField(field, v)}
            />
          ))}
        </div>

        {/* Notifications */}
        <SectionLabel>Notifications</SectionLabel>
        <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded px-4">
          <ToggleRow
            label="Outage alerts for my area"
            checked={!!profile?.alert_opt_in}
            onChange={(v) => updateField("alert_opt_in", v)}
          />
        </div>

        {/* Language */}
        <SectionLabel>Language / زبان</SectionLabel>
        <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] text-[var(--text-primary)]">Display language</span>
          <LanguageToggle />
        </div>

        {/* Edit profile link */}
        <SectionLabel>Account</SectionLabel>
        <div className="bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded">
          <button
            onClick={() => router.push("/onboarding")}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-[var(--bg-border)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <span className="text-[14px] text-[var(--text-primary)]">Edit profile</span>
            <ChevronRight width={16} height={16} className="text-[var(--text-muted)]" />
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <span className="text-[14px] text-[var(--red-alert)]">Sign out</span>
            <LogOut width={16} height={16} className="text-[var(--red-alert)]" />
          </button>
        </div>

        {saving && (
          <p className="text-[11px] text-[var(--text-muted)] text-center mt-4">
            Saving...
          </p>
        )}
      </main>
      <BottomNav />
    </>
  );
}