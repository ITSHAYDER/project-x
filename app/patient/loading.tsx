export default function PatientLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" aria-label="Loading your care space">
      <div className="h-44 animate-pulse rounded-xl bg-night/90 p-6 sm:h-52 sm:p-8">
        <div className="h-3 w-28 rounded-full bg-white/20" />
        <div className="mt-8 h-10 w-48 rounded-lg bg-white/15" />
        <div className="mt-3 h-4 w-72 max-w-full rounded-full bg-white/10" />
      </div>
      <div className="mt-6 animate-pulse rounded-xl border border-hairline bg-[#fffdf8]/90 p-6 sm:p-8">
        <div className="h-3 w-28 rounded-full bg-hairline" />
        <div className="mt-4 h-8 w-72 max-w-full rounded-lg bg-hairline/80" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-hairline/60" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="h-16 rounded-lg bg-hairline/50" /><div className="h-16 rounded-lg bg-hairline/50" /></div>
        <div className="mt-5 h-11 w-32 rounded-lg bg-hairline/70" />
      </div>
    </main>
  );
}
