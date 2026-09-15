import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pagecount",
  description: "Track what you read. Keep the streak. See what your friends are reading.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No mode class here: /login is a marketing surface (display face), the
  // product is app mode (Inter). Each route group sets its own.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
