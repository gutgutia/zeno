import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

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
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
