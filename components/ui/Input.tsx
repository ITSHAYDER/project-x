import {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  TextareaHTMLAttributes,
  HTMLAttributes,
} from "react";

export function Label({
  as = "label",
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> &
  HTMLAttributes<HTMLLegendElement> & { as?: "label" | "legend" }) {
  const sharedClassName = `text-sm font-medium text-ink ${className ?? ""}`;
  if (as === "legend") {
    return <legend {...props} className={sharedClassName} />;
  }
  return <label {...props} className={sharedClassName} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-hairline bg-white px-3.5 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors duration-200 ease-out focus:border-pine focus:bg-pine-soft/20 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-hairline bg-white px-3.5 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors duration-200 ease-out focus:border-pine focus:bg-pine-soft/20 ${props.className ?? ""}`}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-ink/50">{hint}</p>}
    </div>
  );
}
