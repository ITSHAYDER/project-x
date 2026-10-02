"use client";

export function PrintBriefButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden self-start rounded-lg border border-white/25 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
    >
      Print visit brief
    </button>
  );
}