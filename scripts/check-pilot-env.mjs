const required = ["DATABASE_URL", "JWT_SECRET", "REDIS_URL", "TERMII_API_KEY", "PAYSTACK_SECRET_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_BASE_URL", "R2_PRIVATE_BUCKET_NAME", "SENTRY_DSN", "NEXT_PUBLIC_SUPPORT_EMAIL", "NEXT_PUBLIC_SUPPORT_WHATSAPP", "SUPPORT_EMAIL", "SUPPORT_WHATSAPP"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (process.env.NODE_ENV === "production" && process.env.HOME_SERVICES_ENABLED !== "true") missing.push("HOME_SERVICES_ENABLED=true (production pilot approval required)");
if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_HOME_SERVICES_ENABLED !== "true") missing.push("NEXT_PUBLIC_HOME_SERVICES_ENABLED=true (production pilot approval required)");
if (missing.length) {
  console.error("Pilot environment is not configured. Missing:");
  for (const key of missing) console.error(` - ${key}`);
  process.exit(1);
}
console.log("Pilot environment variables are present. This check does not validate provider credentials or connectivity.");
