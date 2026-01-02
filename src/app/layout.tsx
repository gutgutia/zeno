import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
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
    images: ["/social/og-image.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeno - Beautiful Dashboards in Seconds",
    description: "Paste your data, describe what you want, and let AI create stunning, shareable dashboards.",
    images: ["/social/og-image.svg"],
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
