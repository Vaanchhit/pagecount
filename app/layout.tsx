import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Pagecount",
  description: "Track what you read. Keep the streak. See what your friends are reading.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pagecount",
  },
};

export const viewport: Viewport = {
  themeColor: "#F9F6F1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No mode class here: /login is a marketing surface (display face), the
  // product is app mode (Inter). Each route group sets its own.
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
