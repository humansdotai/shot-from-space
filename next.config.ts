import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `next build` and `next dev` both write to `.next` by default, so running a
   * build while a dev server is live corrupts the dev server's manifests and
   * every route starts returning 500. Builds are redirected to `.next-build`
   * via NEXT_DIST_DIR (set by the build and start scripts), so the two can
   * never collide.
   *
   * ON VERCEL THAT GUARD MUST NOT APPLY. The platform looks for the build
   * output at `.next`; honouring NEXT_DIST_DIR there produces a successful
   * build whose output the deployment cannot find. There is no dev server on
   * a build machine, so there is nothing to protect and the guard is pure
   * downside. `VERCEL` is set on every Vercel build and runtime.
   */
  distDir: process.env.VERCEL ? '.next' : process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  // The dev overlay badge sits bottom-left, exactly where the film-frame
  // credit box sits. Hidden so a phone review sees the product, not the tool.
  devIndicators: false,
  images: {
    // Every image is local and public domain — no remote patterns, by design.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 828, 1080, 1200, 1440, 1920, 2400],
  },
  // The poster composer rasterises SVG text with fontconfig: the faces in
  // public/fonts (OTF/TTF — the WOFF2 beside them are for the browser) and
  // the catalogue frames must travel with every function that composes.
  outputFileTracingIncludes: {
    '/api/poster/[code]': ['./public/fonts/**', './public/imagery/**'],
    '/api/print/[code]': ['./public/fonts/**', './public/imagery/**'],
  },
  async redirects() {
    return [
      // The short link printed on every poster: shot.space/M32BF.
      //
      // The pattern is constrained to an actual mission code. Next matches
      // route sources case-insensitively, so a bare `/M:code` also swallows
      // `/missions` and rewrites it to `/m/issions`. Two digits plus two
      // letters cannot collide with any real route.
      { source: '/M:code(\\d{2}[A-Za-z]{2})', destination: '/m/:code', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/imagery/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
