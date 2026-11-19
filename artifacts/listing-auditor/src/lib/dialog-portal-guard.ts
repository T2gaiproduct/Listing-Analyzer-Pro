/** Radix Select/Popover/Menu render in a portal outside Dialog — clicks must not dismiss the parent dialog. */
export function isEventFromDialogPortalLayer(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-select-content]") ||
      target.closest("[data-radix-menu-content]") ||
      target.closest("[data-radix-popover-content]"),
  );
}

export function preventDialogCloseOnPortaledLayers(event: { target: EventTarget | null; preventDefault: () => void }): void {
  if (isEventFromDialogPortalLayer(event.target)) {
    event.preventDefault();
  }
}