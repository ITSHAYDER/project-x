const FACES = ["😔", "🙁", "😐", "🙂", "😊"];

export function ScalePicker({
  name,
  labels = FACES,
  defaultValue,
}: {
  name: string;
  labels?: string[];
  defaultValue?: number;
}) {
  return (
    <div className="flex gap-2 sm:gap-3">
      {labels.map((label, i) => {
        const value = i + 1;
        return (
          <label
            key={value}
            className="group relative flex h-14 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-white/60 text-xl transition-all duration-200 ease-out hover:border-pine/40 hover:bg-pine-soft/40 has-[:checked]:border-pine has-[:checked]:bg-pine has-[:checked]:text-paper has-[:checked]:shadow-[0_8px_20px_rgba(63,93,82,0.12)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pine"
          >
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={defaultValue === value}
              className="sr-only"
              aria-label={`${value} out of ${labels.length}`}
            />
            <span className="transition-transform duration-200 ease-out group-has-[:checked]:scale-105">
              {label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
