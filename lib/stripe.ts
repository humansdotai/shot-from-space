import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazily-constructed Stripe client. Returns null when no key is configured
 *  (keeps the app buildable/importable without secrets in CI). */
export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

/** Absolute origin for building redirect URLs, robust across local + Vercel. */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
