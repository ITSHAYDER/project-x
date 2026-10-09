import { pagePatient } from '@/lib/session';
import { submitGad7Action } from '@/app/actions';
import { GAD7_ITEMS, GAD7_OPTIONS, GAD7_PROMPT } from '@/lib/domain/gad7';
import { ErrorNote } from '@/components/Shell';

export default function Gad7Page({ searchParams }: { searchParams: { error?: string } }) {
  pagePatient();
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">GAD-7</h1>
      <p className="mt-1 text-muted">{GAD7_PROMPT}</p>
      <p className="mt-1 text-sm text-muted">This is a screening questionnaire, not a diagnosis. You will see your total and how it compares with last time. You choose whether your clinician sees it.</p>
      <form action={submitGad7Action} className="mt-6 space-y-5">
        {GAD7_ITEMS.map((item, i) => (
          <fieldset key={i} className="rounded-xl border border-line bg-card p-4">
            <legend className="px-1 font-medium">{i + 1}. {item}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GAD7_OPTIONS.map((o) => (
                <label key={o.value} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-line px-3">
                  <input type="radio" name={`q${i + 1}`} value={o.value} required /> {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="btn btn-primary" type="submit">Save my answers</button>
      </form>
    </div>
  );
}
