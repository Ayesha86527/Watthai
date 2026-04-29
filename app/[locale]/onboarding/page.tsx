"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Zap } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase/client";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function Onboarding() {
  const t = useTranslations("onboarding");
  const tApp = useTranslations("app");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [selectedZone, setSelectedZone] = useState("");
  const [houseDetails, setHouseDetails] = useState({ rooms: 1, acs: 0, fridges: 1 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && step === 1) {
        setStep(3);
      }
    });
    return () => unsubscribe();
  }, [step]);

  const zones = [
    { id: "1", en: "Defence", ur: "ڈیفنس" },
    { id: "2", en: "Clifton", ur: "کلفٹن" },
    { id: "3", en: "Gulistan-e-Johar", ur: "گلستانِ جوہر" },
    { id: "4", en: "Nazimabad", ur: "ناظم آباد" },
    { id: "5", en: "Gulshan-e-Iqbal", ur: "گلشنِ اقبال" },
    { id: "6", en: "PECHS", ur: "پی ای سی ایچ ایس" },
    { id: "7", en: "North Karachi", ur: "نارتھ کراچی" },
    { id: "8", en: "Korangi", ur: "کورنگی" },
    { id: "9", en: "Surjani", ur: "سرجانی" },
    { id: "10", en: "Malir", ur: "ملیر" },
    { id: "11", en: "Lyari", ur: "لیاری" },
    { id: "12", en: "Orangi", ur: "اورنگی" },
    { id: "13", en: "Other", ur: "دیگر" },
  ];

  const handleNext = async () => {
    if (step === 1) {
      if (auth.currentUser) {
        setStep(3);
        return;
      }
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          setStep(3); // Skip phone auth since we use Google Auth for real auth now
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      router.push("/");
    }
  };

  const finishOnboarding = async (alerts: boolean) => {
    try {
      if (auth.currentUser) {
        const ref = doc(db, "users", auth.currentUser.uid);
        const snap = await getDoc(ref);
        
        const data = {
          language: locale,
          zone_id: selectedZone,
          alert_opt_in: alerts,
          house_rooms: houseDetails.rooms,
          house_acs: houseDetails.acs,
          house_fridges: houseDetails.fridges,
        };
        
        if (snap.exists()) {
          await updateDoc(ref, data);
        } else {
          await setDoc(ref, {
            ...data,
            created_at: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
    router.push("/");
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple chars
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  return (
    <main className="flex flex-col h-screen px-4 pb-[env(safe-area-inset-bottom)] pt-12">
      {step === 1 && (
        <div className="flex flex-col flex-1 pb-8 items-center justify-center text-center space-y-8 relative">
          <div className="absolute top-4 right-0">
            <LanguageToggle />
          </div>
          <div>
            <h1 className="text-4xl font-bold font-sans text-[var(--amber)] mb-2">
              {tApp("name")}
            </h1>
            <p className="text-[var(--text-secondary)] text-lg mb-1">
              {tApp("tagline")}
            </p>
            {locale === "en" && (
              <p
                className="text-[var(--text-secondary)] text-md font-urdu"
                dir="rtl"
              >
                اپنا بِل سمجھیں۔ پیسے بچائیں۔
              </p>
            )}
          </div>
          <h2 className="text-2xl font-semibold mt-12">
            {t("welcome_heading")}
          </h2>
          <div className="flex-1" />
          <button
            onClick={handleNext}
            className="w-full py-3 rounded text-[#0C0C0C] bg-[var(--amber)] hover:bg-[#D97706] font-bold transition-colors"
          >
            {t("btn_get_started")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col flex-1 pb-8">
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-6">
            {t("step_phone")}
          </h2>
          <div className="flex items-center space-x-2 w-full mb-6 relative">
            <div className="px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded text-[var(--text-primary)] font-mono select-none">
              +92
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded text-[var(--text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--amber)] transition-all"
              placeholder="3XX XXXXXXX"
            />
          </div>
          <button
            onClick={handleNext} // For demo we skip actual auth
            className="w-full py-3 rounded text-[#0C0C0C] bg-[var(--amber)] hover:bg-[#D97706] font-bold transition-colors mb-8"
          >
            {t("btn_send_code")}
          </button>

          {/* OTP Section (Mocked visibility for UI spec) */}
          <div className="flex justify-between w-full opacity-50 pointer-events-none">
            {otp.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="number"
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                className="w-12 h-14 text-center text-xl font-mono bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--amber)] transition-all"
              />
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col flex-1 pb-8 h-full">
          <div>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
              {t("step_area")}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              {t("step_area_subtitle")}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 mb-6 hide-scrollbar">
            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                className={`w-full text-left p-4 rounded bg-[var(--bg-surface)] border border-[var(--bg-border)] transition-all ${
                  selectedZone === zone.id
                    ? "border-l-4 border-l-[var(--amber)] bg-[var(--bg-elevated)]"
                    : ""
                }`}
              >
                <div className="font-semibold text-[var(--text-primary)]">
                  {zone.en}
                </div>
                <div className="font-urdu text-[var(--text-secondary)] text-sm">
                  {zone.ur}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleNext}
            disabled={!selectedZone}
            className="w-full py-3 rounded text-[#0C0C0C] bg-[var(--amber)] disabled:opacity-50 disabled:bg-[var(--bg-border)] disabled:text-[var(--text-muted)] hover:bg-[#D97706] font-bold transition-colors"
          >
            {t("btn_get_started")}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col flex-1 pb-8 h-full">
          <div>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">
              {t("step_house")}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              {t("step_house_subtitle")}
            </p>
          </div>
          
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
               <div className="flex justify-between items-center bg-[var(--bg-surface)] p-4 rounded border border-[var(--bg-border)]">
                 <span className="font-medium">{t("house_rooms")}</span>
                 <div className="flex items-center space-x-3">
                   <button onClick={() => setHouseDetails(prev => ({...prev, rooms: Math.max(1, prev.rooms - 1)}))} className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--bg-border)] hover:bg-[var(--bg-border)]">-</button>
                   <span className="w-4 text-center font-mono">{houseDetails.rooms}</span>
                   <button onClick={() => setHouseDetails(prev => ({...prev, rooms: prev.rooms + 1}))} className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--bg-border)] hover:bg-[var(--bg-border)]">+</button>
                 </div>
               </div>
               
               <div className="flex justify-between items-center bg-[var(--bg-surface)] p-4 rounded border border-[var(--bg-border)]">
                 <span className="font-medium">{t("house_acs")}</span>
                 <div className="flex items-center space-x-3">
                   <button onClick={() => setHouseDetails(prev => ({...prev, acs: Math.max(0, prev.acs - 1)}))} className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--bg-border)] hover:bg-[var(--bg-border)]">-</button>
                   <span className="w-4 text-center font-mono">{houseDetails.acs}</span>
                   <button onClick={() => setHouseDetails(prev => ({...prev, acs: prev.acs + 1}))} className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--bg-border)] hover:bg-[var(--bg-border)]">+</button>
                 </div>
               </div>
               
               <div className="flex justify-between items-center bg-[var(--bg-surface)] p-4 rounded border border-[var(--bg-border)]">
                 <span className="font-medium">{t("house_fridges")}</span>
                 <div className="flex items-center space-x-3">
                   <button onClick={() => setHouseDetails(prev => ({...prev, fridges: Math.max(0, prev.fridges - 1)}))} className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--bg-border)] hover:bg-[var(--bg-border)]">-</button>
                   <span className="w-4 text-center font-mono">{houseDetails.fridges}</span>
                   <button onClick={() => setHouseDetails(prev => ({...prev, fridges: prev.fridges + 1}))} className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--bg-border)] hover:bg-[var(--bg-border)]">+</button>
                 </div>
               </div>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full py-3 mt-6 rounded text-[#0C0C0C] bg-[var(--amber)] hover:bg-[#D97706] font-bold transition-colors"
          >
            {t("btn_next")}
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col flex-1 pb-8 items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] border border-[var(--bg-border)] flex items-center justify-center mb-6">
            <Zap className="text-[var(--amber)]" width={32} height={32} />
          </div>
          <h2 className="text-2xl font-semibold mb-4">
            {t("step_alerts_heading")}
          </h2>
          <p className="text-[var(--text-secondary)] mb-12 px-4">
            {t("step_alerts_body")}
          </p>

          <div className="w-full space-y-3 mt-auto">
            <button
              onClick={() => finishOnboarding(true)}
              className="w-full py-3 rounded text-[#0C0C0C] bg-[var(--amber)] hover:bg-[#D97706] font-bold transition-colors"
            >
              {t("btn_enable_alerts")}
            </button>
            <button
              onClick={() => finishOnboarding(false)}
              className="w-full py-3 rounded text-[var(--text-primary)] bg-transparent border border-[var(--bg-border)] hover:bg-[var(--bg-elevated)] font-semibold transition-colors"
            >
              {t("btn_maybe_later")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
