import { answerSignal } from '@/app/actions';
import type { Signal } from '@/lib/domain/types';

/** One tap saves. Hours use a numeric field. Neither requires client JavaScript. */
export function ScalePrompt({ signal, reason, current, back }: { signal: Signal; reason: string; current?: number; back?: string }) {
  return (
    <form action={answerSignal} className="rounded-xl border border-line bg-card p-4">
      <input type="hidden" name="signalId" value={signal.id} />
      {back ? <input type="hidden" name="back" value={back} /> : null}
      <div className="flex items-baseline justify-between gap-2">
        <label className="font-medium" htmlFor={`v-${signal.id}`}>
          {signal.kind === 'hours' ? 'How many hours did you sleep?' : signal.id === 'anxiety' ? 'How anxious did today feel?' : signal.id === 'energy' ? 'How was your energy today?' : `${signal.label}?`}
        </label>
        <span className="text-xs text-muted">{reason}</span>
      </div>
      {signal.kind === 'hours' ? (
        <div className="mt-3 flex gap-2">
          <input id={`v-${signal.id}`} className="field num" type="number" name="value" min={0} max={24} step={0.5} inputMode="decimal" defaultValue={current} required />
          <button className="btn btn-primary" type="submit">Save</button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="scale" role="group" aria-label={`${signal.label} from 0 to 10`}>
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="submit" name="value" value={i} aria-label={`${i}`}>
                {i}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{signal.higherIsBetter ? 'low' : 'none'}</span>
            <span>{signal.higherIsBetter ? 'high' : 'a lot'}</span>
          </div>
        </div>
      )}
    </form>
  );
}
