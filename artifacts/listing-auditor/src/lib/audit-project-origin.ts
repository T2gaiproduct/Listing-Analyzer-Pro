export const PROJECT_ORIGIN_AUDIT_LISTING = "audit_listing";
export const PROJECT_ORIGIN_BUILD_BRAND_SCRATCH = "build_brand_scratch";
export const PROJECT_ORIGIN_BUILD_BRAND_IMPORT = "build_brand_import";

export type ProjectOrigin =
  | typeof PROJECT_ORIGIN_AUDIT_LISTING
  | typeof PROJECT_ORIGIN_BUILD_BRAND_SCRATCH
  | typeof PROJECT_ORIGIN_BUILD_BRAND_IMPORT;
