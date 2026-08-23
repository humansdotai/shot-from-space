import type { Metadata, Viewport } from 'next';
import { GrainOverlay } from '@/components/fui';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { ductile, inter, plexMono, typestar } from '@/lib/fonts';
import { SITE_URL } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Shot from Space — a photograph of your home, taken from orbit',
    template: '%s — Shot from Space',
  },
  description:
    'Give an address. A satellite is tasked. The frame is composed with its telemetry, printed locally and shipped as a finished art object.',
  openGraph: {
    title: 'Shot from Space',
    description:
      'Give an address. A satellite is tasked. The frame is composed with its telemetry, printed locally and shipped.',
    type: 'website',
    url: SITE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: '#08090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Inter and Plex are the site faces and set the body. Ductile and Typestar are
 * only DECLARED here: they are used by the mission file and the poster and by
 * nothing else, and a webfont is not fetched until something renders it, so the
 * two extra custom properties cost nothing on pages that never ask for them.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plexMono.variable} ${ductile.variable} ${typestar.variable}`}
    >
      <body className="min-h-dvh bg-void text-paper antialiased">
        <GrainOverlay />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
