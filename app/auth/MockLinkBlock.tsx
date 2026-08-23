/**
 * Mock-mode affordance. In MOCK_MODE the magic link comes back on the API
 * response instead of a mailbox, and this renders it as a real, clickable
 * block.
 *
 * Deliberately amber — the one colour in this product that is not brand
 * colour, because it is not part of the product. Amber marks simulation. It
 * is how the flow is reviewed without a mail provider, and it disappears the
 * moment one is configured.
 *
 * The values are the darker amber: this block now sits on the paper ground of
 * the access screens, where the lighter one only reaches 3:1.
 */

const AMBER_INK = '#8a5a12';
const AMBER_RULE = '#c8862a';

export function MockLinkBlock({ href }: { href: string }) {
  return (
    <div
      className="rounded-card border border-l-2 p-5"
      style={{ borderColor: `${AMBER_RULE}66`, backgroundColor: `${AMBER_RULE}12` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="text-label uppercase" style={{ color: AMBER_INK }}>
          Mock mode / no mail provider
        </span>
        <span className="text-label uppercase" style={{ color: AMBER_INK }}>
          Single use
        </span>
      </div>

      <p className="mt-4 max-w-[var(--measure)] text-body" style={{ color: AMBER_INK }}>
        Nothing was transmitted. The link below is the one that would have been mailed. It
        expires in fifteen minutes and works once.
      </p>

      <a
        href={href}
        className="mt-5 flex min-h-12 items-center rounded-[6px] border px-4 py-3 font-mono text-[0.75rem] leading-[1.5] tracking-[0.04em] break-all transition-house hover:-translate-y-px"
        style={{ borderColor: `${AMBER_RULE}80`, color: AMBER_INK }}
      >
        {href}
      </a>
    </div>
  );
}
