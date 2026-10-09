// All thresholds live here so they can be reviewed, tested and documented in one place.
export const CONFIG = {
  /** Baseline = trailing 28 days, excluding the most recent 7 days. */
  baselineWindowDays: 28,
  baselineGapDays: 7,
  baselineMinEntries: 10,
  baselineMinSpanDays: 13, // first..last entry must span at least 14 calendar days
  /** Shift detection (last 7 days vs the person's own baseline). */
  shiftWindowDays: 7,
  shiftMinEntries: 4,
  shiftMinSameSide: 4,
  /** Minimum meaningful step per signal kind when the IQR is tiny. */
  minStep: { scale_0_10: 1, hours: 0.75, count: 1 } as Record<string, number>,
  /** Period comparison. */
  compareMinEntries: 4,
  /** Pre-declared pair evidence. */
  pairMinPairs: 10,
  pairMinSubgroup: 4,
  pairPresentDiff: 0.3,
  pairWeakDiff: 0.15,
  /** Chain (Moment) edges. */
  chainEmergingDays: 2,
  chainObservedDays: 3,
  chainObservedSpanDays: 14,
  chainTrendWindowDays: 28,
  chainTrendMinMoments: 6,
  chainTrendDiff: 0.15,
  /** Interventions and tools. */
  prePostWindowDays: 14,
  prePostMinEntries: 6,
  toolMinUses: 6,
  toolMinWithout: 6,
  toolDiff: 0.2,
  /** Early signs. */
  earlySignMinDataDays: 56,
  earlySignHarderMinRun: 3,
  earlySignLookbackDays: 7,
  earlySignMinPeriods: 2,
  earlySignCandidatePeriods: 3,
  earlySignMinEntriesInWindow: 3,
  earlySignMinBeyond: 2,
  earlySignMinShare: 0.6,
  earlySignStepFactor: 0.5,
} as const;
