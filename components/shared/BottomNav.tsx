"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Home, ScanLine, Users, FileText, User } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  {
    href: "/",
    icon: Home,
    en: "Home",
    ur: "ہوم",
  },
  {
    href: "/scan",
    icon: ScanLine,
    en: "Scan",
    ur: "اسکین",
  },
  {
    href: "/community",
    icon: Users,
    en: "Community",
    ur: "کمیونٹی",
  },
  {
    href: "/bills",
    icon: FileText,
    en: "Bills",
    ur: "بل",
  },
  {
    href: "/profile",
    icon: User,
    en: "Profile",
    ur: "پروفائل",
  },
];

const HIDDEN_ON = ["/onboarding", "/landing"];

export function BottomNav() {
  const pathname  = usePathname();
  const locale    = useLocale();

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--bg-border)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-5xl w-full flex justify-around items-center h-16 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, en, ur }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors",
                isActive
                  ? "text-[var(--amber)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon width={20} height={20} />
              <span className="text-[10px] font-medium leading-none">
                {locale === "ur" ? ur : en}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}