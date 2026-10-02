import { login } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;

  return (
    <main className="min-h-screen bg-night px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-white"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clay text-sm font-bold">x</span><span className="font-display text-xl">Project X</span></a>
        <a href="/signup" className="text-sm text-white/60 hover:text-white">Create an account <span className="ml-1 text-sky">→</span></a>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-5xl items-center gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <section className="hidden text-white lg:block">
          <p className="eyebrow text-sky">Welcome back</p>
          <h1 className="mt-5 text-5xl leading-tight">Return to a clearer view of your week.</h1>
          <p className="mt-5 max-w-md leading-7 text-white/60">Your notes, check-ins, and patterns are waiting in one quiet place.</p>
          <div className="mt-10 grid max-w-sm gap-3 text-sm text-white/75"><div className="border-l-2 border-clay py-2 pl-4">Pick up where you left off.</div><div className="border-l-2 border-sky py-2 pl-4">See what has changed over time.</div><div className="border-l-2 border-white/30 py-2 pl-4">Keep the next conversation close.</div></div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:p-10">
          <div className="mb-8"><p className="eyebrow">Sign in</p><h2 className="mt-3 text-4xl text-night">Good to see you.</h2><p className="mt-2 text-sm text-ink/55">Continue your private care rhythm.</p></div>
          {message && <p className="mb-5 rounded-lg border border-pine/20 bg-pine-soft px-3 py-2.5 text-sm text-pine-dark">{message}</p>}
          {error && <p className="mb-5 rounded-lg border border-clay/20 bg-clay-soft px-3 py-2.5 text-sm text-clay">{error}</p>}
          <form action={login} className="flex flex-col gap-5">
            {next && <input type="hidden" name="next" value={next} />}
            <Field label="Email address" htmlFor="email"><Input id="email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" /></Field>
            <Field label="Password" htmlFor="password"><Input id="password" type="password" name="password" required autoComplete="current-password" placeholder="Enter your password" /></Field>
            <Button type="submit" className="mt-2 w-full">Log in <span className="ml-2">→</span></Button>
          </form>
          <div className="mt-7 flex items-center gap-3 text-xs text-ink/45"><span className="h-px flex-1 bg-hairline" /><span>private by default</span><span className="h-px flex-1 bg-hairline" /></div>
          <p className="mt-6 text-center text-sm text-ink/55">New to Project X? <a href="/signup" className="font-semibold text-pine underline underline-offset-4">Create your account</a></p>
        </section>
      </div>
    </main>
  );
}
