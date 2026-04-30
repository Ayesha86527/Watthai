"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Zap, MapPin, Home, Users, ChevronRight,
  CheckCircle, Bell, Thermometer, Wind
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase/client";
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ZONES } from "@/lib/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  name: string;
  language: string;
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
  onboarding_complete: boolean;
}

const TOTAL_STEPS = 6;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center space-x-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current
              ? "bg-[var(--amber)] w-4"
              : i === current
              ? "bg-[var(--amber)] w-6 opacity-100"
              : "bg-[var(--bg-border)] w-4"
          }`}
        />
      ))}
    </div>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
      {children}
    </p>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[26px] font-bold text-[var(--text-primary)] leading-tight mb-2">
      {children}
    </h2>
  );
}

function StepSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
      {children}
    </p>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
  loading,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-[52px] rounded bg-[var(--amber)] text-[#0C0C0C] font-bold text-[15px] tracking-wide hover:bg-[#D97706] active:bg-[#B45309] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-[#0C0C0C] border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

function GhostButton({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-[52px] rounded bg-transparent border border-[var(--bg-border)] text-[var(--text-primary)] font-semibold text-[15px] hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-border)] transition-colors"
    >
      {children}
    </button>
  );
}

function Counter({
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center space-x-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 flex items-center justify-center border border-[var(--bg-border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-border)] rounded transition-colors text-[var(--text-primary)] font-mono text-lg leading-none"
      >
        −
      </button>
      <span className="w-10 text-center font-mono text-[17px] text-[var(--text-primary)]">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 flex items-center justify-center border border-[var(--bg-border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-border)] rounded transition-colors text-[var(--text-primary)] font-mono text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}

function CounterRow({
  label,
  sublabel,
  icon: Icon,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex justify-between items-center py-4 border-b border-[var(--bg-border)] last:border-0">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 flex items-center justify-center">
          <Icon width={18} height={18} className="text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-[15px] font-medium text-[var(--text-primary)]">{label}</p>
          {sublabel && (
            <p className="text-[11px] text-[var(--text-muted)]">{sublabel}</p>
          )}
        </div>
      </div>
      <Counter value={value} onChange={onChange} min={min} max={max} />
    </div>
  );
}

function ToggleRow({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex justify-between items-center p-4 rounded border cursor-pointer transition-all ${
        checked
          ? "border-[var(--amber)] bg-[#1C1500]"
          : "border-[var(--bg-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]"
      }`}
    >
      <div>
        <p className={`text-[15px] font-medium ${checked ? "text-[var(--amber)]" : "text-[var(--text-primary)]"}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{sublabel}</p>
        )}
      </div>
      <div
        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all ${
          checked
            ? "bg-[var(--amber)] border-[var(--amber)]"
            : "border-[var(--bg-border)]"
        }`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#0C0C0C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Save helpers ─────────────────────────────────────────────────────────────

async function saveProgress(uid: string, data: Partial<UserProfile & { created_at?: any }>) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, data);
  } else {
    await setDoc(ref, { ...data, created_at: serverTimestamp() });
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep]         = useState(0); // 0 = welcome
  const [user, setUser]         = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Form state
  const [name, setName]         = useState("");
  const [zone, setZone]         = useState("");
  const [society, setSociety]   = useState("");
  const [persons, setPersons]   = useState(3);
  const [rooms, setRooms]       = useState(2);
  const [acs, setAcs]           = useState(1);
  const [hasInverter, setHasInverter]           = useState(false);
  const [hasGeyser, setHasGeyser]               = useState(false);
  const [hasWashingMachine, setHasWashingMachine] = useState(false);
  const [hasWaterPump, setHasWaterPump]         = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      // If already signed in and hits onboarding, check if already complete
      if (u) {
        getDoc(doc(db, "users", u.uid)).then((snap) => {
          if (snap.exists() && snap.data()?.onboarding_complete) {
            router.push("/");
          }
        });
      }
    });
    return () => unsub();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      // Pre-fill name from Google account
      if (result.user.displayName) {
        setName(result.user.displayName.split(" ")[0]); // First name only
      }
      setStep(2); // Jump to personal info step
    } catch (err: any) {
      setError("Sign in failed. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const goNext = useCallback(async () => {
    if (!user) return;
    setError(null);
    setSaving(true);

    try {
      // Save progress at each step
      if (step === 2) {
        await saveProgress(user.uid, { name, language: locale });
        setStep(3);
      } else if (step === 3) {
        await saveProgress(user.uid, { zone_id: zone, society_name: society });
        setStep(4);
      } else if (step === 4) {
        await saveProgress(user.uid, { persons_in_house: persons, rooms });
        setStep(5);
      } else if (step === 5) {
        await saveProgress(user.uid, {
          ac_count: acs,
          has_inverter: hasInverter,
          has_geyser: hasGeyser,
          has_washing_machine: hasWashingMachine,
          has_water_pump: hasWaterPump,
        });
        setStep(6);
      }
    } catch (err: any) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [step, user, locale, name, zone, society, persons, rooms, acs, hasInverter, hasGeyser, hasWashingMachine, hasWaterPump]);

  const finishOnboarding = async (alertOptIn: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      await saveProgress(user.uid, {
        alert_opt_in: alertOptIn,
        onboarding_complete: true,
      });
      router.push("/");
    } catch (err: any) {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] flex flex-col px-5 pt-safe">

      {/* ── Top bar ── */}
      <div className="flex justify-between items-center pt-12 pb-8">
        {step > 0 && step < 6 ? (
          <ProgressDots current={step} total={TOTAL_STEPS} />
        ) : (
          <div />
        )}
        <LanguageToggle />
      </div>

      {/* ── Step 0: Welcome ── */}
      {step === 0 && (
        <div className="flex flex-col flex-1 justify-between pb-10">
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* Logo */}
            <div>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--amber)] rounded mb-6">
                <Zap width={28} height={28} className="text-[#0C0C0C]" />
              </div>
              <h1 className="text-[40px] font-bold text-[var(--amber)] leading-none tracking-tight mb-2">
                WattHai
              </h1>
              <p className="text-[17px] text-[var(--text-secondary)]">
                Understand your bill. Save money.
              </p>
              <p className="text-[15px] text-[var(--text-muted)] font-urdu mt-1" dir="rtl">
                اپنا بِل سمجھیں۔ پیسے بچائیں۔
              </p>
            </div>

            {/* Feature pills */}
            <div className="space-y-2 pt-4">
              {[
                { icon: "📊", text: "AI bill analysis in seconds" },
                { icon: "📍", text: "Neighborhood outage alerts" },
                { icon: "💡", text: "Personalized savings tips in Rs." },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-3 p-3 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded"
                >
                  <span className="text-[18px]">{f.icon}</span>
                  <span className="text-[14px] text-[var(--text-secondary)]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <PrimaryButton onClick={() => setStep(1)} loading={false}>
              Get Started
            </PrimaryButton>
            <p className="text-[11px] text-[var(--text-muted)] text-center px-4">
              For K-Electric consumers in Karachi
            </p>
          </div>
        </div>
      )}

      {/* ── Step 1: Sign In ── */}
      {step === 1 && (
        <div className="flex flex-col flex-1 justify-between pb-10">
          <div className="flex-1 flex flex-col justify-center">
            <StepLabel>Step 1 of {TOTAL_STEPS}</StepLabel>
            <StepHeading>Create your account</StepHeading>
            <StepSubtitle>
              Sign in with Google to save your bills, track usage, and get outage alerts.
            </StepSubtitle>

            <div className="mt-10 space-y-4">
              {/* Google sign in card */}
              <button
                onClick={handleGoogleSignIn}
                disabled={saving}
                className="w-full p-4 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)] transition-all flex items-center space-x-4 disabled:opacity-50"
              >
                {/* Google logo SVG */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-[15px] font-medium text-[var(--text-primary)]">
                  Continue with Google
                </span>
                <ChevronRight width={16} height={16} className="text-[var(--text-muted)] ml-auto" />
              </button>

              {error && (
                <p className="text-[13px] text-[var(--red-alert)] text-center">{error}</p>
              )}

              <div className="flex items-center space-x-3 px-1">
                <div className="flex-1 h-px bg-[var(--bg-border)]" />
                <span className="text-[11px] text-[var(--text-muted)]">your data stays private</span>
                <div className="flex-1 h-px bg-[var(--bg-border)]" />
              </div>

              <div className="space-y-2">
                {[
                  "Bills stored securely — only you can see them",
                  "Benchmarking uses anonymized zone averages",
                  "No data sold to third parties",
                ].map((item, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <CheckCircle width={14} height={14} className="text-[var(--teal)] mt-0.5 shrink-0" />
                    <span className="text-[13px] text-[var(--text-muted)]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Personal Info ── */}
      {step === 2 && (
        <div className="flex flex-col flex-1 justify-between pb-10">
          <div className="flex-1">
            <StepLabel>Step 2 of {TOTAL_STEPS}</StepLabel>
            <StepHeading>What should we call you?</StepHeading>
            <StepSubtitle>
              Your first name — used to personalize your dashboard.
            </StepSubtitle>

            <div className="mt-8 space-y-4">
              <div>
                <label className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] block mb-2">
                  YOUR NAME
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha"
                  autoFocus
                  className="w-full px-4 py-3.5 bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded text-[var(--text-primary)] text-[17px] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--amber)] focus:border-transparent transition-all font-sans"
                />
              </div>

              {/* Signed in as */}
              {user && (
                <div className="flex items-center space-x-3 p-3 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded">
                  {user.photoURL && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)]">Signed in as</p>
                    <p className="text-[13px] text-[var(--text-secondary)]">{user.email}</p>
                  </div>
                  <CheckCircle width={16} height={16} className="text-[var(--teal)] ml-auto" />
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[var(--red-alert)] text-center mb-3">{error}</p>
          )}
          <PrimaryButton
            onClick={goNext}
            disabled={name.trim().length < 2}
            loading={saving}
          >
            Continue <ChevronRight width={16} height={16} className="inline ml-1" />
          </PrimaryButton>
        </div>
      )}

      {/* ── Step 3: Location ── */}
      {step === 3 && (
        <div className="flex flex-col flex-1 pb-10 min-h-0">
          <div className="mb-6">
            <StepLabel>Step 3 of {TOTAL_STEPS}</StepLabel>
            <StepHeading>Where do you live?</StepHeading>
            <StepSubtitle>
              Used for outage alerts and comparing your usage with nearby households.
            </StepSubtitle>
          </div>

          {/* Society name input */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] block mb-2">
              APARTMENT SOCIETY / AREA NAME <span className="text-[var(--text-muted)] normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={society}
              onChange={(e) => setSociety(e.target.value)}
              placeholder="e.g. Bahria Town, DHA Phase 6, Gulshan Block 7"
              className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded text-[var(--text-primary)] text-[15px] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--amber)] focus:border-transparent transition-all"
            />
          </div>

          {/* Zone selector */}
          <label className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] block mb-2">
            NEIGHBORHOOD / ZONE
          </label>
          <div className="flex-1 overflow-y-auto space-y-1.5 mb-5 pr-0.5"
            style={{ scrollbarWidth: 'none' }}>
            {ZONES.map((z) => {
              const selected = zone === z.id;
              return (
                <button
                  key={z.id}
                  onClick={() => setZone(z.id)}
                  className={`w-full text-left px-4 py-3.5 rounded border transition-all flex items-center justify-between ${
                    selected
                      ? "border-[var(--amber)] bg-[#1C1500]"
                      : "border-[var(--bg-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <MapPin
                      width={14}
                      height={14}
                      className={selected ? "text-[var(--amber)]" : "text-[var(--text-muted)]"}
                    />
                    <div>
                      <span className={`text-[15px] font-medium ${selected ? "text-[var(--amber)]" : "text-[var(--text-primary)]"}`}>
                        {z.en}
                      </span>
                      <span className="text-[13px] text-[var(--text-muted)] font-urdu mr-3 block leading-tight" dir="rtl">
                        {z.ur}
                      </span>
                    </div>
                  </div>
                  {selected && (
                    <CheckCircle width={16} height={16} className="text-[var(--amber)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-[13px] text-[var(--red-alert)] text-center mb-3">{error}</p>
          )}
          <PrimaryButton onClick={goNext} disabled={!zone} loading={saving}>
            Continue <ChevronRight width={16} height={16} className="inline ml-1" />
          </PrimaryButton>
        </div>
      )}

      {/* ── Step 4: Household Size ── */}
      {step === 4 && (
        <div className="flex flex-col flex-1 justify-between pb-10">
          <div className="flex-1">
            <StepLabel>Step 4 of {TOTAL_STEPS}</StepLabel>
            <StepHeading>Tell us about your home</StepHeading>
            <StepSubtitle>
              This helps us compare your usage with similar households in {zone ? ZONES.find(z => z.id === zone)?.en : "your area"}.
            </StepSubtitle>

            <div className="mt-8 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded px-4">
              <CounterRow
                icon={Users}
                label="People in household"
                sublabel="Including children"
                value={persons}
                onChange={setPersons}
                min={1}
                max={15}
              />
              <CounterRow
                icon={Home}
                label="Rooms"
                sublabel="Bedrooms + living areas"
                value={rooms}
                onChange={setRooms}
                min={1}
                max={15}
              />
            </div>

            {/* Context note */}
            <div className="mt-4 p-3 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded flex items-start space-x-2">
              <span className="text-[var(--amber)] mt-0.5">ℹ</span>
              <p className="text-[13px] text-[var(--text-muted)]">
                A typical Karachi apartment with {persons} people uses{" "}
                <span className="font-mono text-[var(--text-secondary)]">
                  {200 + persons * 40 + rooms * 20}–{300 + persons * 50 + rooms * 30}
                </span>{" "}
                units/month.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[var(--red-alert)] text-center mb-3">{error}</p>
          )}
          <PrimaryButton onClick={goNext} loading={saving}>
            Continue <ChevronRight width={16} height={16} className="inline ml-1" />
          </PrimaryButton>
        </div>
      )}

      {/* ── Step 5: Appliances ── */}
      {step === 5 && (
        <div className="flex flex-col flex-1 justify-between pb-10">
          <div className="flex-1">
            <StepLabel>Step 5 of {TOTAL_STEPS}</StepLabel>
            <StepHeading>What appliances do you have?</StepHeading>
            <StepSubtitle>
              Your savings tips will be calculated based on your actual appliances.
            </StepSubtitle>

            <div className="mt-8 space-y-3">
              {/* AC counter — most impactful */}
              <div className="p-4 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Thermometer width={18} height={18} className="text-[var(--text-muted)]" />
                    <div>
                      <p className="text-[15px] font-medium text-[var(--text-primary)]">Air Conditioners</p>
                      <p className="text-[11px] text-[var(--text-muted)]">Biggest driver of your bill</p>
                    </div>
                  </div>
                  <Counter value={acs} onChange={setAcs} min={0} max={10} />
                </div>
                {acs > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--bg-border)]">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      With {acs} AC{acs > 1 ? "s" : ""} running ~8 hrs/day, you're spending roughly{" "}
                      <span className="font-mono text-[var(--amber)]">
                        Rs. {(acs * 8 * 1.5 * 30 * 4.2).toFixed(0)}
                      </span>{" "}
                      on AC alone this month.
                    </p>
                  </div>
                )}
              </div>

              {/* Toggle appliances */}
              <div className="grid grid-cols-2 gap-2">
                <ToggleRow
                  label="Inverter / UPS"
                  sublabel="Backup power"
                  checked={hasInverter}
                  onChange={setHasInverter}
                />
                <ToggleRow
                  label="Geyser"
                  sublabel="Water heater"
                  checked={hasGeyser}
                  onChange={setHasGeyser}
                />
                <ToggleRow
                  label="Washing Machine"
                  sublabel="Automatic"
                  checked={hasWashingMachine}
                  onChange={setHasWashingMachine}
                />
                <ToggleRow
                  label="Water Pump"
                  sublabel="Roof tank"
                  checked={hasWaterPump}
                  onChange={setHasWaterPump}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[var(--red-alert)] text-center mb-3">{error}</p>
          )}
          <PrimaryButton onClick={goNext} loading={saving}>
            Continue <ChevronRight width={16} height={16} className="inline ml-1" />
          </PrimaryButton>
        </div>
      )}

      {/* ── Step 6: Alerts + Finish ── */}
      {step === 6 && (
        <div className="flex flex-col flex-1 justify-between pb-10">
          <div className="flex-1 flex flex-col justify-center">
            <div className="w-14 h-14 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded flex items-center justify-center mb-6">
              <Bell width={28} height={28} className="text-[var(--amber)]" />
            </div>

            <StepLabel>Step 6 of {TOTAL_STEPS}</StepLabel>
            <StepHeading>Stay ahead of outages</StepHeading>
            <StepSubtitle>
              When 10+ neighbors in {zone ? ZONES.find(z => z.id === zone)?.en : "your area"} report a power cut, we'll notify you instantly.
            </StepSubtitle>

            {/* Summary card */}
            <div className="mt-8 p-4 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded space-y-3">
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
                YOUR PROFILE SUMMARY
              </p>
              <div className="space-y-2">
                {[
                  { label: "Name",     value: name },
                  { label: "Area",     value: ZONES.find(z => z.id === zone)?.en ?? zone },
                  { label: "Household", value: `${persons} people, ${rooms} rooms` },
                  { label: "ACs",      value: acs === 0 ? "None" : `${acs} unit${acs > 1 ? "s" : ""}` },
                  {
                    label: "Appliances",
                    value: [
                      hasInverter && "Inverter",
                      hasGeyser && "Geyser",
                      hasWashingMachine && "Washing Machine",
                      hasWaterPump && "Water Pump",
                    ].filter(Boolean).join(", ") || "None selected",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-start">
                    <span className="text-[13px] text-[var(--text-muted)] w-24 shrink-0">{label}</span>
                    <span className="text-[13px] text-[var(--text-primary)] text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[var(--red-alert)] text-center mb-3">{error}</p>
          )}
          <div className="space-y-3">
            <PrimaryButton
              onClick={() => finishOnboarding(true)}
              loading={saving}
            >
              <Bell width={16} height={16} className="inline mr-2" />
              Enable Alerts &amp; Finish
            </PrimaryButton>
            <GhostButton onClick={() => finishOnboarding(false)}>
              Skip for now
            </GhostButton>
          </div>
        </div>
      )}

    </main>
  );
}