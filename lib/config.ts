// One codebase, two ways to run it.
//   APP_MODE=showcase (default): the version you show investors, psychologists and clinics.
//     Synthetic personas, one-click persona switching, guided tour, presenter notes, reset button.
//   APP_MODE=product: the real deal. No personas, no resets, no presenter notes. Needs real auth
//     and the Supabase repository (docs/slices/02-supabase.md). Until those exist it shows a clear
//     "not configured" screen instead of pretending.
// The engine, privacy rules, design and screens are shared, so improvements land in both.
export type AppMode = 'showcase' | 'product';

export function appMode(): AppMode {
  return process.env.APP_MODE === 'product' ? 'product' : 'showcase';
}
export function isShowcase(): boolean {
  return appMode() === 'showcase';
}
export function allowRealPatientData(): boolean {
  return process.env.ALLOW_REAL_PATIENT_DATA === 'true' && appMode() === 'product';
}
