export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="soft-panel flex flex-col items-start gap-3 px-4 py-6 sm:px-5">
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="max-w-lg text-sm leading-6 text-ink/65">{description}</p>
      {action}
    </div>
  );
}
