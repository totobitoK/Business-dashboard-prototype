"use client";

import { useEffect } from "react";
import { ManageDrawerBody } from "@/components/admin/ManageDrawerBody";
import { ManageDrawerOverview } from "@/components/admin/ManageDrawerOverview";
import { getActivationEligibility } from "@/lib/client-activation";
import { isFinalBalancePaid } from "@/lib/client-milestones";
import { useClientStore } from "@/lib/client-store";

interface ManageDrawerProps {
  clientId: string | null;
  onClose: () => void;
}

export function ManageDrawer({ clientId, onClose }: ManageDrawerProps) {
  const { clients, activateClient, setClientStatus } = useClientStore();
  const client = clients.find((c) => c.id === clientId) ?? null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (clientId) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [clientId, onClose]);

  if (!client) return null;

  const activation = getActivationEligibility(client);
  const canActivate = activation.canActivate;

  const primaryBtnClass =
    "rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baby-400";

  const secondaryBtnClass =
    "rounded-lg border border-baby-200 bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-baby-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baby-400";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-navy/20"
        aria-label="Close manage panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-drawer-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-baby-200 bg-white shadow-card"
      >
        <div className="flex items-center justify-between border-b border-baby-100 px-6 py-4">
          <h2 id="manage-drawer-title" className="sr-only">
            Manage {client.company}
          </h2>
          <p className="text-sm font-medium text-navy-muted">Client details</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-navy-muted hover:bg-baby-50 hover:text-navy"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <ManageDrawerOverview client={client} />
          <ManageDrawerBody client={client} />
        </div>

        <div className="border-t border-baby-100 px-6 py-4">
          {client.status === "pending" && (
            <button
              type="button"
              onClick={() => activateClient(client.id)}
              disabled={!canActivate}
              className={
                primaryBtnClass +
                " w-full disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {canActivate
                ? "Activate client"
                : !isFinalBalancePaid(client)
                  ? "Activate client — final setup balance unpaid"
                  : "Activate client — complete guided setup, build, and review"}
            </button>
          )}
          {client.status === "active" && (
            <button
              type="button"
              onClick={() => setClientStatus(client.id, "archived")}
              className={
                secondaryBtnClass +
                " w-full border-amber-200 text-amber-800 hover:bg-amber-50"
              }
            >
              Archive client
            </button>
          )}
          {client.status === "archived" && (
            <>
              <button
                type="button"
                onClick={() => setClientStatus(client.id, "active")}
                disabled={!canActivate}
                className={
                  primaryBtnClass +
                  " w-full disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {canActivate
                  ? "Reactivate client"
                  : "Reactivate client — requirements not met"}
              </button>
              {!canActivate && (
                <p className="mt-2 text-xs text-navy-muted">
                  {activation.blockedReasons.join(" ")}
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
