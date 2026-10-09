# Design notes

- **Statement types are visible everywhere**: REPORTED (solid rule), OBSERVED (dotted rule), TOPIC (amber block, italic, "possible topic, not a finding").
- **The Thread**: a thin vertical line connecting open items on Today.
- **Baseline band** is shown where the question is asked, so data appears where it is used.
- Warm neutral palette, one ink-teal accent, one amber for "worth a look". Never red/green alone; lines on the Map differ by dash pattern, not just colour.
- System font stacks (no network fonts). To add Source Serif 4 / Inter, self-host them and set `--font-serif` / `--font-sans`.
- Every chart has a table alternative; touch targets are at least 44px; focus rings are visible; motion is off under `prefers-reduced-motion`.
- Copy: plain, no exclamation marks, no "you should", no streaks or points.
