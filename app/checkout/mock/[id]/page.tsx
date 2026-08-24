import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normalizeMissionCode } from '@/lib/codes';
import { MockCheckout } from '@/components/purchase/MockCheckout';

export const metadata: Metadata = {
  title: 'Payment authorisation',
  description: 'Mock hosted checkout. No payment is taken in mock mode.',
  robots: { index: false, follow: false },
};

/**
 * /checkout/mock/[id] — the stand-in for Stripe Checkout in mock mode.
 *
 * `id` is the mission code returned by POST /api/orders. Once
 * STRIPE_SECRET_KEY is set, /api/orders returns a stripe.com Checkout URL and
 * this route is never linked to again; it can be deleted with no other change
 * to the purchase flow.
 */
export default async function MockCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const code = normalizeMissionCode(id);
  if (!code) notFound();

  return <MockCheckout missionCode={code} />;
}
