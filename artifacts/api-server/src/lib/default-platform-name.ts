/** Default product name when admin Platform Name / APP_DISPLAY_NAME is unset. */
export const DEFAULT_PLATFORM_NAME =
  process.env.APP_DISPLAY_NAME?.trim() || "Ecommerce Guru";

export function platformDisplayName(name?: string | null): string {
  return name?.trim() || DEFAULT_PLATFORM_NAME;
}

export function platformAiName(name?: string | null): string {
  return `${platformDisplayName(name)} AI`;
}
