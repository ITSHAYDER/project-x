import { signup } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;

  return (
    <main className="min-h-screen bg-paper px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between"><a href="/" className="flex items-center gap-2 text-night"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-night text-sm font-bold text-white">x</span><span className="font-display text-xl">Project X</span></a><a href="/login" className="text-sm font-medium text-ink/60 hover:text-pine-dark">Already have an account? <span className="text-pine">Log in</span></a></div>
      <div className="mx-auto grid max-w-6xl items-start gap-10 py-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:py-16">
        <section className="lg:sticky lg:top-10"><p className="eyebrow">Make space for the in-between</p><h1 className="mt-5 max-w-lg text-5xl leading-tight text-night sm:text-6xl">Start with one small, useful habit.</h1><p className="mt-5 max-w-md text-lg leading-8 text-ink/60">Project X helps you collect the details that are easy to lose and the patterns that are hard to see alone.</p><div className="mt-8 rounded-2xl bg-night p-5 text-white"><p className="text-xs uppercase tracking-[0.18em] text-sky">What you get</p><div className="mt-5 space-y-4 text-sm text-white/75"><div className="flex gap-3"><span className="text-clay">01</span><span>A quick daily check-in that respects your energy.</span></div><div className="flex gap-3"><span className="text-clay">02</span><span>A calmer view of your changing patterns.</span></div><div className="flex gap-3"><span className="text-clay">03</span><span>A better starting point for your next conversation.</span></div></div></div></section>

        <section className="rounded-2xl border border-hairline bg-white p-6 shadow-[0_24px_70px_rgba(28,42,74,0.08)] sm:p-10"><div className="mb-7"><p className="eyebrow">Create your account</p><h2 className="mt-3 text-4xl text-night">Let&apos;s make it yours.</h2><p className="mt-2 text-sm text-ink/55">Set up your private space in about a minute.</p></div>
          {error && <p className="mb-5 rounded-lg border border-clay/20 bg-clay-soft px-3 py-2.5 text-sm text-clay">{error}</p>}
          <form action={signup} className="flex flex-col gap-5">
            {next && <input type="hidden" name="next" value={next} />}
            <fieldset className="flex flex-col gap-3"><legend className="text-sm font-semibold text-ink">How will you use Project X?</legend><div className="grid gap-3 sm:grid-cols-2"><label className="group cursor-pointer rounded-xl border border-hairline p-4 transition-colors has-[:checked]:border-pine has-[:checked]:bg-pine-soft/70"><input type="radio" name="role" value="patient" required className="sr-only" /><span className="flex items-center justify-between"><span className="font-semibold text-ink">For myself</span><span className="text-lg text-pine opacity-0 group-has-[:checked]:opacity-100">✓</span></span><span className="mt-1 block text-xs leading-5 text-ink/55">Track your own rhythm and prepare for care.</span></label><label className="group cursor-pointer rounded-xl border border-hairline p-4 transition-colors has-[:checked]:border-pine has-[:checked]:bg-pine-soft/70"><input type="radio" name="role" value="psychiatrist" required className="sr-only" /><span className="flex items-center justify-between"><span className="font-semibold text-ink">For my practice</span><span className="text-lg text-pine opacity-0 group-has-[:checked]:opacity-100">✓</span></span><span className="mt-1 block text-xs leading-5 text-ink/55">Support patients with clearer shared context.</span></label></div></fieldset>
            <Field label="Your name" htmlFor="display_name"><Input id="display_name" name="display_name" required autoComplete="name" placeholder="Your name" /></Field>
            <Field label="Email address" htmlFor="email"><Input id="email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" /></Field>
            <Field label="Password" htmlFor="password" hint="Use at least 8 characters."><Input id="password" type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="Create a password" /></Field>
            <Button type="submit" className="mt-2 w-full">Create account <span className="ml-2">→</span></Button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-ink/45">By creating an account, you are choosing a private space designed for continuity of care.</p>
        </section>
      </div>
    </main>
  );
}
