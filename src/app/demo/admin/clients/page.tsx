import { Suspense } from "react";
import { ClientsPageContent } from "./ClientsPageContent";

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-navy-muted">Loading clients…</p>
      }
    >
      <ClientsPageContent />
    </Suspense>
  );
}
