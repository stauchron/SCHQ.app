import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-tier">{hint}</span>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-none border border-line bg-white px-4 py-3 text-base text-black outline-none transition-colors duration-200 ease-staudt placeholder:text-muted focus:border-navy";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label,
  hint,
  error,
  className = "",
  ...rest
}: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <input className={`${inputClass} ${className}`} {...rest} />
    </FieldShell>
  );
}

type NumberFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  unit?: string;
};

export function NumberField({
  label,
  hint,
  error,
  unit,
  className = "",
  ...rest
}: NumberFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          className={`${inputClass} ${unit ? "pr-12" : ""} ${className}`}
          {...rest}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs uppercase tracking-[0.2em] text-tier">
            {unit}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextArea({
  label,
  hint,
  error,
  className = "",
  rows = 4,
  ...rest
}: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <textarea rows={rows} className={`${inputClass} ${className}`} {...rest} />
    </FieldShell>
  );
}
