import type { Metadata } from "next";
import { Inter } from "next/font/google";
import {
  getMarketingDescription,
  getMarketingPageTitle,
} from "@/lib/branding";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: getMarketingPageTitle(),
  description: getMarketingDescription(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
