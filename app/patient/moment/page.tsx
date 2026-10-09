import { pagePatient } from '@/lib/session';
import { addMomentAction } from '@/app/actions';
import { ErrorNote } from '@/components/Shell';

export default function MomentPage({ searchParams }: { searchParams: { error?: string } }) {
  const { data } = pagePatient();
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">Something happened</h1>
      <p className="mt-1 text-muted">Twenty seconds. Only the first box is needed. This becomes part of your Map.</p>
      <form action={addMomentAction} className="mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="situation">What was happening?</label>
          <input id="situation" className="field" name="situation" maxLength={120} required placeholder="e.g. Team meeting" />
        </div>
        <div>
          <label className="label" htmlFor="thought">What went through your mind?</label>
          <input id="thought" className="field" name="thought" maxLength={200} placeholder="e.g. I sounded stupid" />
        </div>
        <div>
          <label className="label" htmlFor="emotion">What did you feel?</label>
          <input id="emotion" className="field" name="emotion" maxLength={60} placeholder="e.g. Embarrassed" />
        </div>
        <div>
          <label className="label" htmlFor="intensity">How strong? (0 to 10)</label>
          <input id="intensity" className="field num" type="number" name="intensity" min={0} max={10} defaultValue={5} required />
        </div>
        <div>
          <label className="label" htmlFor="behavior">What did you do?</label>
          <input id="behavior" className="field" name="behavior" maxLength={120} placeholder="e.g. Stayed quiet" />
        </div>
        {data.tools.length > 0 ? (
          <fieldset>
            <legend className="label">Did you try anything?</legend>
            <div className="flex flex-wrap gap-2">
              {data.tools.map((t) => (
                <label key={t.id} className="chip"><input type="checkbox" name="tools" value={t.id} /> {t.label}</label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <fieldset>
          <legend className="label">Who can see this?</legend>
          <div className="flex gap-3">
            <label className="chip"><input type="radio" name="visibility" value="private" defaultChecked={!data.consents.share_moments_default} /> Only me</label>
            <label className="chip"><input type="radio" name="visibility" value="shared" defaultChecked={data.consents.share_moments_default} /> Me and my clinician</label>
          </div>
        </fieldset>
        <button className="btn btn-primary" type="submit">Save</button>
      </form>
    </div>
  );
}
