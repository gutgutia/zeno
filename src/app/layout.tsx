import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

// JSON-LD Structured Data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://zeno.fyi/#organization",
      "name": "Zeno",
      "url": "https://zeno.fyi",
      "logo": {
        "@type": "ImageObject",
        "url": "https://zeno.fyi/brand/mark-branded.svg",
        "width": 512,
        "height": 512,
      },
      "sameAs": [],
      "description": "AI-powered dashboard generation platform. Create beautiful, shareable dashboards from your data in seconds.",
    },
    {
      "@type": "WebSite",
      "@id": "https://zeno.fyi/#website",
      "url": "https://zeno.fyi",
      "name": "Zeno",
      "publisher": {
        "@id": "https://zeno.fyi/#organization",
      },
      "description": "Create beautiful dashboards in seconds with AI. Upload your data, describe what you want, and Zeno generates stunning visualizations.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://zeno.fyi/#software",
      "name": "Zeno",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free tier available with pay-as-you-go credits",
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5",
        "ratingCount": "1",
        "bestRating": "5",
        "worstRating": "1",
      },
      "featureList": [
        "AI-powered dashboard generation",
        "CSV and Excel data import",
        "Google Sheets integration",
        "Interactive charts and visualizations",
        "Shareable dashboard links",
        "Custom branding",
        "Team collaboration",
      ],
      "screenshot": "https://zeno.fyi/social/og-image.png",
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://zeno.fyi"),
  title: "Zeno - Beautiful Dashboards in Seconds",
  description: "Paste your data, describe what you want, and let AI create stunning, shareable dashboards. No spreadsheet skills required.",
  keywords: ["dashboard", "data visualization", "AI", "analytics", "charts"],
  authors: [{ name: "Zeno" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/mark-branded.svg",
  },
  openGraph: {
    title: "Zeno - Beautiful Dashboards in Seconds",
    description: "Paste your data, describe what you want, and let AI create stunning, shareable dashboards.",
    url: "https://zeno.fyi",
    siteName: "Zeno",
    type: "website",
    images: [
      {
        url: "/social/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zeno - Beautiful Dashboards in Seconds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeno - Beautiful Dashboards in Seconds",
    description: "Paste your data, describe what you want, and let AI create stunning, shareable dashboards.",
    images: ["/social/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
