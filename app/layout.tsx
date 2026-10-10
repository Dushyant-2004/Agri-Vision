import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriVision | Smart Agribusiness Analytics",
  description: "Evidence-based agricultural production analytics dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
