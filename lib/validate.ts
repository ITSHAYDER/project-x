// Small, dependency-free input validation for server actions. Every action validates server-side.
export class ValidationError extends Error {}

export function str(fd: FormData, key: string, max: number, opts: { required?: boolean } = {}): string {
  const v = fd.get(key);
  const s = typeof v === 'string' ? v.trim() : '';
  if (opts.required && s.length === 0) throw new ValidationError(`${key} is required`);
  if (s.length > max) throw new ValidationError(`${key} is too long`);
  return s;
}
export function num(fd: FormData, key: string, min: number, max: number): number {
  const v = fd.get(key);
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(`${key} must be between ${min} and ${max}`);
  return n;
}
export function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[]): T {
  const v = fd.get(key);
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw new ValidationError(`${key} is invalid`);
  return v as T;
}
export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === 'true';
}
export const SIGNAL_RANGE: Record<string, [number, number]> = {
  scale_0_10: [0, 10],
  hours: [0, 24],
  count: [0, 100],
};
