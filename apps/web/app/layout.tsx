import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ULTRA — Verified Property Marketplace, Abuja",
  description: "Find verified homes, plots, and rentals in Abuja. Every listing checked, every realtor verified.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
