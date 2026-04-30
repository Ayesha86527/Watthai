"use client";

import { BottomNav } from "@/components/shared/BottomNav";
import { Users } from "lucide-react";

export default function CommunityPage() {
  return (
    <>
      <main className="px-4 pt-4 pb-[88px]">
        <div className="mb-6">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1">
            NEIGHBORHOOD
          </p>
          <h1 className="text-[26px] font-bold text-[var(--text-primary)]">
            Community
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded flex items-center justify-center mb-4">
            <Users width={24} height={24} className="text-[var(--text-muted)]" />
          </div>
          <p className="text-[17px] font-semibold text-[var(--text-primary)] mb-2">
            Coming soon
          </p>
          <p className="text-[14px] text-[var(--text-muted)] max-w-[240px]">
            Report outages and get real-time alerts from your neighbors.
          </p>
        </div>
      </main>
      <BottomNav />
    </>
  );
}