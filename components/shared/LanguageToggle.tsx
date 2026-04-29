"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import clsx from "clsx";

export function LanguageToggle() {
  const currentLocale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex bg-[var(--bg-elevated)] rounded-full p-1 border border-[var(--bg-border)]">
      <Link
        href={pathname}
        locale="en"
        className={clsx(
          "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors",
          currentLocale === "en"
            ? "bg-[var(--amber)] text-[#0C0C0C]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
        )}
      >
        EN
      </Link>
      <Link
        href={pathname}
        locale="ur"
        className={clsx(
          "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors font-urdu",
          currentLocale === "ur"
            ? "bg-[var(--amber)] text-[#0C0C0C]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
        )}
      >
        UR
      </Link>
    </div>
  );
}
