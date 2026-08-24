/**
 * Environment surface.
 *
 * MOCK_MODE is the master switch. It is TRUE by default: a fresh clone runs
 * the entire product end to end with realistic fake data and no keys.
 * Set MOCK_MODE=false and supply the keys listed in .env.example to go live —
 * see INTEGRATIONS.md.
 */

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

export const MOCK_MODE = flag(process.env.MOCK_MODE, true);

/** Public mirror of MOCK_MODE for client components. */
export const PUBLIC_MOCK_MODE = flag(
  process.env.NEXT_PUBLIC_MOCK_MODE ?? process.env.MOCK_MODE,
  true,
);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Per-integration live switches. All require MOCK_MODE=false as well. */
export const INTEGRATIONS = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  },
  skyfi: {
    apiKey: process.env.SKYFI_API_KEY ?? '',
    baseUrl: process.env.SKYFI_API_BASE_URL ?? 'https://app.skyfi.com/platform-api',
    webhookSecret: process.env.SKYFI_WEBHOOK_SECRET ?? '',
  },
  gelato: {
    apiKey: process.env.GELATO_API_KEY ?? '',
    baseUrl: process.env.GELATO_API_BASE_URL ?? 'https://order.gelatoapis.com',
    webhookSecret: process.env.GELATO_WEBHOOK_SECRET ?? '',
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? '',
    agentId: process.env.ELEVENLABS_AGENT_ID ?? '',
  },
  llm: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.MISSION_CONTROL_MODEL ?? 'claude-sonnet-4-20250514',
  },
  email: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'Mission Control <mission@shotfromspace.com>',
  },
  geocoder: {
    apiKey: process.env.MAPBOX_ACCESS_TOKEN ?? '',
  },
} as const;

/**
 * The values each integration must have before its live path may run.
 *
 * Webhook secrets are deliberately NOT required here. They are needed to
 * *verify* an inbound callback, not to make an outbound call, and a missing one
 * should surface as a rejected webhook rather than as a service silently
 * staying in mock mode. `.env.example` still lists them, and the deployment
 * checklist in INTEGRATIONS.md treats them as mandatory for production.
 */
const REQUIRED_KEYS: Record<keyof typeof INTEGRATIONS, readonly string[]> = {
  stripe: ['secretKey', 'publishableKey'],
  skyfi: ['apiKey', 'baseUrl'],
  gelato: ['apiKey', 'baseUrl'],
  elevenlabs: ['apiKey', 'agentId'],
  llm: ['apiKey', 'model'],
  email: ['apiKey', 'from'],
  geocoder: ['apiKey'],
};

/** True when a given integration has everything it needs to run live. */
export function isLive(name: keyof typeof INTEGRATIONS): boolean {
  if (MOCK_MODE) return false;
  const cfg = INTEGRATIONS[name] as Record<string, string>;
  return REQUIRED_KEYS[name].every((k) => typeof cfg[k] === 'string' && cfg[k].length > 0);
}

/** Names of every integration still running on mocks. Logged once at boot. */
export function mockedIntegrations(): string[] {
  return (Object.keys(INTEGRATIONS) as (keyof typeof INTEGRATIONS)[]).filter((n) => !isLive(n));
}
