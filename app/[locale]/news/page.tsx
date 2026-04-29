"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";

export default function NewsPage() {
  const t = useTranslations("news");
  const [filter, setFilter] = useState("All");

  const filters = [
    t("filter_all"),
    t("filter_tariffs"),
    t("filter_nepra"),
    t("filter_loadshedding"),
    t("filter_ke"),
  ];

  const newsItems = [
    {
      id: 1,
      title:
        "NEPRA okays Rs2.75 per unit FCA for Karachi consumers for January",
      source: "DAWN",
      time: "2h ago",
      url: "#",
    },
    {
      id: 2,
      title:
        "K-Electric announces summer load-shedding schedule, exempts 70% areas",
      source: "GEO",
      time: "5h ago",
      url: "#",
    },
    {
      id: 3,
      title:
        "Consumers to face additional burden of Rs40bn due to quarterly adjustments",
      source: "TRIBUNE",
      time: "1d ago",
      url: "#",
    },
    {
      id: 4,
      title:
        "Meter reading issues: KE introduces self-assessment portal for residential users",
      source: "KE",
      time: "2d ago",
      url: "#",
    },
  ];

  return (
    <main className="px-4 pb-[88px] pt-4 flex flex-col min-h-screen">
      <h1 className="text-[20px] font-bold text-[var(--text-primary)] font-sans tracking-tight mb-4">
        {t("header").toUpperCase()}
      </h1>

      <div className="flex space-x-2 overflow-x-auto hide-scrollbar mb-6 pb-2 -mx-4 px-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors border ${
              filter === f
                ? "bg-[var(--amber)] text-[#0C0C0C] border-[var(--amber)]"
                : "bg-transparent text-[var(--text-secondary)] border-[var(--bg-border)] hover:text-[var(--text-primary)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-0">
        {newsItems.map((news) => (
          <a
            key={news.id}
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-4 border-b border-[var(--bg-border)] group"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-[11px] font-medium bg-[var(--bg-elevated)] border border-[var(--bg-border)] px-1.5 py-0.5 rounded-sm">
                {news.source}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {news.time}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <h3 className="text-[15px] text-[var(--text-primary)] font-medium leading-[1.3] group-hover:text-[var(--amber)] transition-colors pr-4">
                {news.title}
              </h3>
              <ExternalLink
                width={16}
                height={16}
                className="text-[var(--text-muted)] mt-1 flex-shrink-0"
              />
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
