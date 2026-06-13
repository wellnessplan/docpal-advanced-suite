/**
 * Accessibility helpers for forms.
 * - focusFirstInvalid: focuses the first [aria-invalid="true"] / .has-error input inside a container.
 * - describedByIds: utility to build a stable list of aria-describedby ids (helper, error).
 */

export function focusFirstInvalid(container?: HTMLElement | null): boolean {
  const root: ParentNode = container ?? document;
  const el =
    root.querySelector<HTMLElement>('[aria-invalid="true"]') ||
    root.querySelector<HTMLElement>('[data-invalid="true"]');
  if (!el) return false;
  // Prefer the first focusable inside, or the element itself
  const focusable =
    el.matches('input, select, textarea, button, [tabindex]')
      ? el
      : el.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]');
  (focusable || el).focus?.();
  (focusable || el).scrollIntoView?.({ block: "center", behavior: "smooth" });
  return true;
}

export function describedByIds(fieldId: string, opts: { hasError?: boolean; hasHelper?: boolean }) {
  const ids: string[] = [];
  if (opts.hasError) ids.push(`${fieldId}-error`);
  if (opts.hasHelper) ids.push(`${fieldId}-helper`);
  return ids.length ? ids.join(" ") : undefined;
}

/**
 * Wire react-hook-form's handleSubmit to focus the first invalid input on failure.
 * Usage: <form onSubmit={form.handleSubmit(onSubmit, onInvalidFocus(formRef))} />
 */
export function onInvalidFocus(containerRef?: { current: HTMLElement | null }) {
  return () => {
    // Defer to next frame so RHF has applied aria-invalid
    requestAnimationFrame(() => focusFirstInvalid(containerRef?.current ?? null));
  };
}
