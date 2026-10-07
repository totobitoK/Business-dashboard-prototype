"use client";

import { useClientStore } from "@/lib/client-store";

export function DemoBanner() {
  const { resetToDemoData } = useClientStore();

  return (
    <div className="fixed left-0 right-0 top-0 z-30 border-b border-purple-100 bg-purple-50/80 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <p className="text-ink-muted">
          <span className="font-medium text-ink">Demo data</span> — not
          connected to live systems. Saved locally in your browser.
        </p>
        <button
          type="button"
          onClick={resetToDemoData}
          className="shrink-0 rounded-md border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple transition-colors hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
        >
          Reset sample data
        </button>
      </div>
    </div>
  );
}
