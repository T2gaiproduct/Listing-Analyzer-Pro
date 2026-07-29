/** Settings keys that must never be returned in API responses or logs. */
export const SECRET_SETTING_KEYS = new Set([
  "stripe_secret_key",
  "stripe_webhook_secret",
  "razorpay_key_secret",
  "razorpay_webhook_secret",
  "paypal_client_secret",
  "openai_api_key",
  "gemini_api_key",
  "smtp_password",
  "amazon_sp_client_secret",
  "amazon_aws_secret_access_key",
  "api_webhook_secret",
  "amazon_api_key",
  "amazon_api_secret",
]);

export function isSecretSettingKey(key: string, isSecretFlag = false): boolean {
  if (isSecretFlag) return true;
  if (SECRET_SETTING_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return lower.includes("secret") || lower.includes("password");
}

export function maskSettingValue(key: string, value: string, isSecretFlag = false): string {
  return isSecretSettingKey(key, isSecretFlag) ? "***" : value;
}
