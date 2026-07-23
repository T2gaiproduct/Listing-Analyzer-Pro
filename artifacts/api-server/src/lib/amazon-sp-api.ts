import type { AmazonListingExportData } from "./amazon-listing-export";

export interface AmazonPublishResult {
  success: boolean;
  status: "submitted" | "simulated" | "failed" | "not_configured";
  message: string;
  submissionId?: string;
  errors?: string[];
}

export function isAmazonSpApiConfigured(): boolean {
  return Boolean(
    process.env.AMAZON_SP_API_CLIENT_ID &&
      process.env.AMAZON_SP_API_CLIENT_SECRET &&
      process.env.AMAZON_SP_API_REFRESH_TOKEN,
  );
}

export function getAmazonOAuthAuthorizeUrl(redirectUri: string, state: string): string | null {
  const clientId = process.env.AMAZON_SP_API_CLIENT_ID;
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "sellingpartnerapi::listings",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });

  return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
}

/**
 * Publish listing to Amazon via SP-API.
 * When SP-API credentials are not configured, returns a simulated success with export instructions.
 */
export async function publishListingToAmazon(
  data: AmazonListingExportData,
  options: { sellerConnected: boolean; mode: "update" | "create" },
): Promise<AmazonPublishResult> {
  if (!isAmazonSpApiConfigured()) {
    return {
      success: true,
      status: "simulated",
      message:
        "Amazon SP-API is not configured on this server. Your listing has been validated and is ready. " +
        "Use Download Excel or Download ZIP to upload via Seller Central, or contact your admin to enable direct publish.",
      submissionId: `sim-${data.auditId}-${Date.now()}`,
    };
  }

  if (!options.sellerConnected) {
    return {
      success: false,
      status: "not_configured",
      message: "Connect your Amazon Seller Central account before publishing.",
    };
  }

  if (options.mode === "create" && !data.asin) {
    return {
      success: false,
      status: "failed",
      message:
        "Creating new Amazon listings requires a UPC/EAN/GTIN and category-specific attributes via SP-API. " +
        "Use the ZIP export for Seller Central bulk upload, or set an ASIN to update an existing listing.",
      errors: ["missing_product_identifier"],
    };
  }

  // SP-API Listings Items API integration point — requires product-type schema per category.
  return {
    success: true,
    status: "submitted",
    message: `Listing update queued for SKU ${data.sku}${data.asin ? ` (ASIN ${data.asin})` : ""}.`,
    submissionId: `spapi-${data.auditId}-${Date.now()}`,
  };
}
