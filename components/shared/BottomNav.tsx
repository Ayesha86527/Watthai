"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Home, ScanLine, Users, Newspaper, History } from "lucide-react";
import clsx from "clsx";

export function BottomNav() {
  const pathname = usePathname();
  const locale = useLocale();

  const navItems = [
    { icon: Home, href: "/", label: locale === "ur" ? "ہوم" : "Home" },
    {
      icon: ScanLine,
      href: "/scan",
      label: locale === "ur" ? "اسکین" : "Scan",
    },
    {
      icon: Users,
      href: "/community",
      label: locale === "ur" ? "کمیونٹی" : "Community",
    },
    {
      icon: Newspaper,
      href: "/news",
      label: locale === "ur" ? "خبریں" : "News",
    },
    {
      icon: History,
      href: "/history",
      label: locale === "ur" ? "تاریخ" : "History",
    },
  ];

  if (pathname === "/onboarding") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--bg-border)] pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto w-full flex justify-around items-center h-16 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive
                  ? "text-[var(--amber)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon width={20} height={20} />
              <span className="text-[11px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
