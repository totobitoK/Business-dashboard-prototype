import { redirect } from "next/navigation";
import { marketingRoutes } from "@/lib/routes";

/** Legacy path — public site lives at /. */
export default function MarketingRedirectPage() {
  redirect(marketingRoutes.home);
}
