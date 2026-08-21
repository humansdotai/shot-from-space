import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shot From Space — task a satellite to photograph your house",
  description:
    "Enter an address, task a satellite, pay, and get a fresh capture of your rooftop from low Earth orbit. A live mission-control globe tracks the pass in 3D.",
  metadataBase: new URL("https://shot-from-space.vercel.app"),
  openGraph: {
    title: "Shot From Space",
    description:
      "Task a real satellite to photograph your house. Pick coordinates, pay, watch the pass in a live 3D mission control.",
    url: "https://shot-from-space.vercel.app",
    siteName: "Shot From Space",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shot From Space",
    description: "Task a satellite to photograph your house.",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="space-bg" aria-hidden />
        <div className="space-grid" aria-hidden />
        {children}
      </body>
    </html>
  );
}
