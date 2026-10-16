import { redirect } from "next/navigation";
import { adminRoutes } from "@/lib/routes";

export default function LiveAdminIndexPage() {
  redirect(adminRoutes.clients);
}
