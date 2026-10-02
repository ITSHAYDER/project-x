export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" aria-label="Loading Project X">
      <div className="h-12 animate-pulse rounded-xl bg-hairline/70" />
      <div className="mt-8 h-48 animate-pulse rounded-xl bg-night/90" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="h-40 animate-pulse rounded-xl border border-hairline bg-[#fffdf8]/90" /><div className="h-40 animate-pulse rounded-xl border border-hairline bg-[#fffdf8]/90" /></div>
    </main>
  );
}
