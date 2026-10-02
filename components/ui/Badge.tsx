export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "attention" | "positive";
  children: React.ReactNode;
}) {
  const toneClasses = {
    neutral: "bg-hairline/50 text-ink/70",
    attention: "bg-clay-soft text-clay",
    positive: "bg-pine-soft text-pine-dark",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses}`}
    >
      {children}
    </span>
  );
}
