import { logout } from "@/app/login/actions";
import Link from "next/link";

export function AppShell({
  displayName,
  links,
  children,
}: {
  displayName: string;
  links: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const isPatient = links.some((link) => link.href.startsWith("/patient"));
  const navigation = isPatient
    ? [
        { href: "/patient/dashboard", label: "Today" },
        { href: "/patient/prepare", label: "Prepare" },
        { href: "/patient/discussions", label: "To discuss" },
        { href: "/patient/timeline", label: "Timeline" },
      ]
    : [
        { href: "/psychiatrist/dashboard", label: "Patients" },
        { href: "/psychiatrist/dashboard#visit-requests", label: "Visit requests" },
      ];

  const patientMore = isPatient
    ? [
        { href: "/patient/assessment", label: "Assessment" },
        { href: "/patient/insights", label: "Insights" },
        { href: "/patient/journal", label: "Journal" },
        { href: "/patient/settings", label: "Privacy" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-paper">
      <header className="app-shell-header sticky top-0 z-20 border-b border-hairline bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={navigation[0]?.href ?? "/"}
              className="flex shrink-0 items-center gap-2 text-night"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-night font-display text-base text-white">x</span>
              <span className="font-display text-lg">Project X</span>
            </Link>
            <span className="hidden text-xs text-ink/40 sm:inline">{isPatient ? "Your care space" : "Practice workspace"}</span>
          </div>
          <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-hairline bg-white/70 p-1">
            {navigation.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch
                  className="nav-pill"
                >
                  {link.label}
                </Link>
            ))}
            {patientMore.length > 0 && (
              <details className="relative shrink-0">
                <summary className="nav-pill cursor-pointer list-none">More <span aria-hidden="true">+</span></summary>
                <div className="absolute right-0 top-full z-30 mt-2 grid min-w-36 gap-1 rounded-xl border border-hairline bg-[#fffdf8] p-1 shadow-[0_16px_35px_rgba(34,47,39,0.12)]">
                  {patientMore.map((link) => (
                    <Link key={link.href} href={link.href} prefetch className="nav-pill whitespace-nowrap">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </nav>
          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <span className="hidden rounded-full border border-hairline bg-white/75 px-2.5 py-1 text-sm text-ink/60 shadow-[0_8px_18px_rgba(17,20,19,0.03)] sm:inline">
              {displayName}
            </span>
            <form action={logout}>
              <button className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm font-medium text-ink/60 transition-colors duration-200 ease-out hover:border-pine/30 hover:text-ink">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
