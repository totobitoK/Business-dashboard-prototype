import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/marketing/MarketingHomePage";
import { branding, getMarketingDescription } from "@/lib/branding";

export const metadata: Metadata = {
  title: `${branding.fullName} | Your business, in one clear view.`,
  description: getMarketingDescription(),
};

export default function HomePage() {
  return <MarketingHomePage />;
}
