import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Standardized form validation primitives — purely presentational, framework-agnostic.
 * Use alongside react-hook-form or any controlled form. All states use semantic tokens.
 *
 * Pattern:
 *   <FormFieldShell
 *     label="Phone"
 *     required
 *     error={errors.phone?.message}
 *     touched={touchedFields.phone}
 *     dirty={dirtyFields.phone}
 *     helper="10-digit mobile number"
 *   >
 *     <Input {...register("phone")} aria-invalid={!!errors.phone} />
 *   </FormFieldShell>
 */

type FieldState = "idle" | "error" | "success";

function getState({ error, touched, dirty }: { error?: string; touched?: boolean; dirty?: boolean }): FieldState {
  if (error) return "error";
  if (touched && dirty && !error) return "success";
  return "idle";
}

export interface FormFieldShellProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  helper?: React.ReactNode;
  error?: string;
  touched?: boolean;
  dirty?: boolean;
  showSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormFieldShell({
  label,
  htmlFor,
  required,
  optional,
  helper,
  error,
  touched,
  dirty,
  showSuccess = false,
  className,
  children,
}: FormFieldShellProps) {
  const state = getState({ error, touched, dirty });

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={htmlFor} className={cn(state === "error" && "text-destructive")}>
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          {optional && <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Optional</span>}
        </div>
      )}

      <div
        className={cn(
          "group/fld",
          // ring helpers (Input already styles its own border, but this lets non-Input controls inherit state)
          state === "error" && "[&_input]:border-destructive [&_textarea]:border-destructive [&_[data-state]]:border-destructive",
          state === "success" &&
            showSuccess &&
            "[&_input]:border-emerald-500/60 [&_textarea]:border-emerald-500/60",
        )}
      >
        {children}
      </div>

      {state === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : state === "success" && showSuccess ? (
        <p className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Looks good</span>
        </p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

/** Inline error message — for use inside custom layouts where FormFieldShell is overkill. */
export function FieldError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("flex items-start gap-1.5 text-xs font-medium text-destructive", className)}>
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** Helper text — neutral hint below an input. */
export function FieldHelper({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>{children}</p>;
}

/** Form-wide error summary banner — for server-side errors. */
export function FormErrorSummary({
  title = "Please fix the highlighted fields",
  errors,
  className,
}: {
  title?: string;
  errors?: string[];
  className?: string;
}) {
  if (!errors || errors.length === 0) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive",
        className,
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4" />
        {title}
      </div>
      {errors.length > 0 && (
        <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-xs">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
