"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { normalizeClients } from "./client-migration";
import {
  CLIENT_DEMO_STORAGE_KEY,
  loadPersistedClients,
  mergeMissingDemoClients,
  mutatePersistedClientList,
} from "./client-store-persistence";
import { demoClients, DEFAULT_MONTHLY_FEE, DEFAULT_SETUP_FEE } from "./demo-data";
import { toFullAnswers } from "./onboarding-form";
import { syncGuidedConnectionsFromScope } from "./client-milestones";
import type {
  Client,
  ClientFormData,
  ClientMilestone,
  ClientOnboardingAnswers,
  ClientOnboardingDraft,
  ClientStatus,
  ConnectionDemoStatus,
  Note,
  OnboardingPath,
  OnboardingStep,
  Payment,
  PaymentType,
} from "./types";
import { canActivateClient } from "./client-activation";
import {
  buildPreviewInvalidationPatch,
  getCurrentPreviewRevision,
} from "./preview-review";
import {
  getStepsForPath,
  isOnboardingComplete,
} from "./onboarding";
import {
  canAcceptScopeCard,
  exportScopeCardToServer,
  type ScopeCardExportResult,
} from "./scope-card-export";
import {
  scheduleScopeCardSync,
  scheduleScopeCardSyncImmediate,
  shouldAutoExportScopeCard,
  touchesScopeCardFields,
} from "./scope-card-sync";

interface ClientStoreContextValue {
  clients: Client[];
  addClient: (data: ClientFormData) => Client;
  updateClient: (
    id: string,
    updates: Partial<Client>
  ) => { ok: boolean; error?: string };
  setClientStatus: (id: string, status: ClientStatus) => void;
  setOnboardingPath: (id: string, path: OnboardingPath) => void;
  toggleStep: (id: string, step: OnboardingStep) => void;
  addPayment: (
    id: string,
    amount: number,
    type: PaymentType,
    options?: {
      note?: string;
      dateReceived?: string;
      methodReference?: string;
      recordSource?: Payment["recordSource"];
    }
  ) => { ok: boolean; error?: string };
  addNote: (id: string, content: string) => void;
  activateClient: (id: string) => void;
  saveOnboardingDraft: (id: string, draft: ClientOnboardingDraft) => void;
  submitOnboarding: (id: string, answers: ClientOnboardingAnswers) => void;
  acceptScopeCard: (id: string) => Promise<ScopeCardExportResult>;
  toggleAdminMilestone: (id: string, milestone: ClientMilestone) => void;
  updateGuidedConnectionDemoStatus: (
    id: string,
    connectionId: string,
    status: ConnectionDemoStatus
  ) => void;
  setPaymentOnlyPrepConfirmed: (id: string, confirmed: boolean) => void;
  submitCustomerPreviewFeedback: (id: string, feedback: string) => boolean;
  approveCustomerPreview: (id: string) => { ok: boolean; error?: string };
  markPreviewReadyForReview: (id: string) => void;
  resetToDemoData: () => void;
}

const ClientStoreContext = createContext<ClientStoreContextValue | null>(null);

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function syncSetupPayment(client: Client): Client {
  const setupPayments = client.payments
    .filter((p) => p.type === "setup")
    .reduce((s, p) => s + p.amount, 0);
  const refunds = client.payments
    .filter((p) => p.type === "refund")
    .reduce((s, p) => s + p.amount, 0);
  const paid = Math.max(0, setupPayments - refunds);
  let completedSteps = [...client.completedSteps];

  if (paid >= client.setupFee) {
    if (!completedSteps.includes("setup-payment-received")) {
      completedSteps.push("setup-payment-received");
    }
  } else {
    completedSteps = completedSteps.filter((s) => s !== "setup-payment-received");
  }

  return { ...client, setupPaidAmount: paid, completedSteps };
}

function readInitialClients(): Client[] {
  if (typeof window === "undefined") return demoClients;
  try {
    return loadPersistedClients(demoClients);
  } catch (err) {
    console.error("Failed to load demo data from storage; using defaults.", err);
    try {
      localStorage.removeItem(CLIENT_DEMO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return normalizeClients(demoClients);
  }
}

export function ClientStoreProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>(demoClients);
  const [hydrated, setHydrated] = useState(false);
  const clientsRef = useRef(clients);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  const applyClientsUpdate = useCallback(
    (updater: (base: Client[]) => Client[]): { ok: boolean; error?: string } => {
      const result = mutatePersistedClientList(
        demoClients,
        updater,
        () => localStorage.getItem(CLIENT_DEMO_STORAGE_KEY),
        (json) => localStorage.setItem(CLIENT_DEMO_STORAGE_KEY, json)
      );
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      clientsRef.current = result.clients;
      setClients(result.clients);
      return { ok: true };
    },
    []
  );

  const persistScopeCardResult = useCallback(
    (id: string, result: ScopeCardExportResult) => {
      if (!result.ok || !result.card) return;
      applyClientsUpdate((base) =>
        base.map((c) =>
          c.id === id
            ? {
                ...c,
                scopeCardVersion: result.card!.card_version,
                scopeCardExportedAt: result.card!.updated_at,
              }
            : c
        )
      );
    },
    [applyClientsUpdate]
  );

  const exportScopeCardForClient = useCallback(
    async (client: Client) => {
      if (!shouldAutoExportScopeCard(client)) return;
      const result = await exportScopeCardToServer(client);
      persistScopeCardResult(client.id, result);
      return result;
    },
    [persistScopeCardResult]
  );

  const runScopeCardSync = useCallback(
    async (id: string) => {
      const client = clientsRef.current.find((c) => c.id === id);
      if (!client) return;
      await exportScopeCardForClient(client);
    },
    [exportScopeCardForClient]
  );

  const queueScopeCardSync = useCallback(
    (id: string, immediate = false) => {
      if (immediate) {
        scheduleScopeCardSyncImmediate(id, () => {
          void runScopeCardSync(id);
        });
        return;
      }
      scheduleScopeCardSync(id, () => {
        void runScopeCardSync(id);
      });
    },
    [runScopeCardSync]
  );

  useEffect(() => {
    try {
      const loaded = readInitialClients();
      clientsRef.current = loaded;
      setClients(loaded);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CLIENT_DEMO_STORAGE_KEY || event.newValue == null) return;
      try {
        const parsed = JSON.parse(event.newValue) as Client[];
        const next = normalizeClients(mergeMissingDemoClients(parsed, demoClients));
        clientsRef.current = next;
        setClients(next);
      } catch {
        /* ignore malformed cross-tab payload */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrated]);

  const updateClient = useCallback(
    (id: string, updates: Partial<Client>) => {
      const result = applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          let next: Client = { ...c, ...updates };
          if ("acceptedSourcesIn" in updates) {
            next = {
              ...next,
              guidedConnections: syncGuidedConnectionsFromScope(next),
            };
          }
          const scopeChanged =
            "acceptedSourcesIn" in updates ||
            "agreedScopeSummary" in updates ||
            "dashboardScope" in updates;
          const buildReopened =
            "adminCompletedMilestones" in updates &&
            !(updates.adminCompletedMilestones ?? []).includes("building") &&
            (c.adminCompletedMilestones ?? []).includes("building");
          if (scopeChanged || buildReopened) {
            next = {
              ...next,
              ...buildPreviewInvalidationPatch(
                next,
                scopeChanged
                  ? "Preview approval cleared — agreed scope changed."
                  : "Preview approval cleared — build marked incomplete."
              ),
            };
          }
          if (
            c.status === "active" &&
            !c.launchedAt &&
            updates.status === undefined
          ) {
            next = { ...next, launchedAt: c.createdAt };
          }
          return next;
        })
      );
      if (result.ok && touchesScopeCardFields(updates)) {
        queueScopeCardSync(id);
      }
      return result;
    },
    [applyClientsUpdate, queueScopeCardSync]
  );

  const addClient = useCallback((data: ClientFormData): Client => {
    const notes: Note[] = [];
    if (data.initialNote?.trim()) {
      notes.push({
        id: generateId("note"),
        date: new Date().toISOString(),
        content: data.initialNote.trim(),
      });
    }

    const newClient: Client = {
      id: generateId("client"),
      company: data.company,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      website: data.website?.trim() || undefined,
      serviceName: data.serviceName?.trim() || undefined,
      dashboardScope: data.dashboardScope?.trim() || undefined,
      dataSourcesNeeded: data.dataSourcesNeeded?.trim() || undefined,
      targetLaunchDate: data.targetLaunchDate?.trim() || undefined,
      status: "pending",
      setupFee: data.setupFee,
      monthlyFee: data.monthlyFee,
      onboardingPath: data.onboardingPath,
      completedSteps: [],
      setupPaidAmount: 0,
      subscriptionActive: false,
      onboardingFormStatus:
        data.onboardingPath === "full" ? "not-started" : undefined,
      payments: [],
      notes,
      files: [],
      createdAt: new Date().toISOString(),
    };
    applyClientsUpdate((base) => [...base, newClient]);
    return newClient;
  }, [applyClientsUpdate]);

  const setClientStatus = useCallback(
    (id: string, status: ClientStatus) => {
      applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          if (status === "active") {
            if (!canActivateClient(c)) return c;
            return {
              ...c,
              status: "active",
              subscriptionActive: true,
              completedSteps: getStepsForPath(c.onboardingPath),
              launchedAt: c.launchedAt ?? new Date().toISOString(),
            };
          }
          if (status === "archived") {
            return { ...c, status: "archived", subscriptionActive: false };
          }
          if (status === "pending") {
            return {
              ...c,
              status: "pending",
              subscriptionActive: false,
              completedSteps: c.completedSteps.filter((s) => s !== "active"),
            };
          }
          return { ...c, status };
        })
      );
      queueScopeCardSync(id);
    },
    [applyClientsUpdate, queueScopeCardSync]
  );

  const setOnboardingPath = useCallback((id: string, path: OnboardingPath) => {
    applyClientsUpdate((base) =>
      base.map((c) => {
        if (c.id !== id || c.status !== "pending") return c;
        const validSteps = getStepsForPath(path);
        return {
          ...c,
          onboardingPath: path,
          completedSteps: c.completedSteps.filter((s) =>
            validSteps.includes(s)
          ),
          onboardingFormStatus:
            path === "full" ? c.onboardingFormStatus ?? "not-started" : undefined,
        };
      })
    );
  }, [applyClientsUpdate]);

  const toggleStep = useCallback((id: string, step: OnboardingStep) => {
    applyClientsUpdate((base) =>
      base.map((c) => {
        if (c.id !== id || c.status !== "pending") return c;
        const steps = getStepsForPath(c.onboardingPath);
        if (!steps.includes(step)) return c;

        const isCompleted = c.completedSteps.includes(step);
        if (isCompleted) {
          const stepIndex = steps.indexOf(step);
          const toRemove = new Set(steps.slice(stepIndex));
          const updates: Partial<Client> = {
            completedSteps: c.completedSteps.filter((s) => !toRemove.has(s)),
          };
          if (step === "scope-pricing-confirmed") {
            updates.scopePricingConfirmedAt = undefined;
          }
          return { ...c, ...updates };
        }

        const stepIndex = steps.indexOf(step);
        const prerequisites = steps.slice(0, stepIndex);
        const allPrereqsMet = prerequisites.every((s) =>
          c.completedSteps.includes(s)
        );
        if (!allPrereqsMet && step !== steps[0]) return c;

        if (step === "setup-payment-received" && c.setupPaidAmount < c.setupFee) {
          return c;
        }

        if (step === "scope-pricing-confirmed" && !c.scopePricingConfirmedAt) {
          return {
            ...c,
            completedSteps: [...c.completedSteps, step],
            scopePricingConfirmedAt: new Date().toISOString(),
          };
        }

        return {
          ...c,
          completedSteps: [...c.completedSteps, step],
        };
      })
    );
  }, [applyClientsUpdate]);

  const addPayment = useCallback(
    (
      id: string,
      amount: number,
      type: PaymentType,
      options?: {
        note?: string;
        dateReceived?: string;
        methodReference?: string;
        recordSource?: Payment["recordSource"];
      }
    ) => {
      const dateIso = options?.dateReceived
        ? `${options.dateReceived}T12:00:00.000Z`
        : new Date().toISOString();
      const payment: Payment = {
        id: generateId("pay"),
        date: dateIso,
        amount,
        type,
        note: options?.note,
        methodReference: options?.methodReference?.trim() || undefined,
        recordSource: options?.recordSource ?? "offline",
      };
      const result = applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          return syncSetupPayment({
            ...c,
            payments: [...c.payments, payment],
          });
        })
      );
      if (result.ok) queueScopeCardSync(id);
      return result;
    },
    [applyClientsUpdate, queueScopeCardSync]
  );

  const addNote = useCallback((id: string, content: string) => {
    const note: Note = {
      id: generateId("note"),
      date: new Date().toISOString(),
      content,
    };
    applyClientsUpdate((base) =>
      base.map((c) =>
        c.id === id ? { ...c, notes: [...c.notes, note] } : c
      )
    );
  }, [applyClientsUpdate]);

  const activateClient = useCallback(
    (id: string) => {
      applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id || !canActivateClient(c)) return c;
          return {
            ...c,
            status: "active",
            subscriptionActive: true,
            completedSteps: getStepsForPath(c.onboardingPath),
            launchedAt: c.launchedAt ?? new Date().toISOString(),
          };
        })
      );
      queueScopeCardSync(id);
    },
    [applyClientsUpdate, queueScopeCardSync]
  );

  const saveOnboardingDraft = useCallback(
    (id: string, draft: ClientOnboardingDraft) => {
      applyClientsUpdate((base) =>
        base.map((c) =>
          c.id === id
            ? {
                ...c,
                onboardingFormStatus: "in-progress" as const,
                onboardingDraft: draft,
              }
            : c
        )
      );
    },
    [applyClientsUpdate]
  );

  const submitOnboarding = useCallback(
    (id: string, answers: ClientOnboardingAnswers) => {
      const full = toFullAnswers(answers);
      const submittedAt = new Date().toISOString();
      let submittedClient: Client | undefined;

      applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          const completedSteps: OnboardingStep[] = c.completedSteps.includes(
            "requirements-submitted"
          )
            ? c.completedSteps
            : [...c.completedSteps, "requirements-submitted"];
          submittedClient = {
            ...c,
            company: full.company,
            contactName: full.contactName,
            email: full.email,
            phone: full.phone,
            website: full.website,
            onboardingFormStatus: "submitted" as const,
            onboardingDraft: undefined,
            onboardingSubmission: { ...full, submittedAt },
            completedSteps,
          };
          return submittedClient!;
        })
      );

      if (submittedClient) {
        void exportScopeCardForClient(submittedClient);
      }
    },
    [applyClientsUpdate, exportScopeCardForClient]
  );

  const acceptScopeCard = useCallback(async (id: string): Promise<ScopeCardExportResult> => {
    let clientToExport: Client | undefined;

    applyClientsUpdate((base) =>
      base.map((c) => {
        if (c.id !== id) return c;
        if (!canAcceptScopeCard(c) && !c.completedSteps.includes("scope-pricing-confirmed")) {
          return c;
        }

        let next: Client = { ...c };
        if (!c.completedSteps.includes("scope-pricing-confirmed")) {
          if (!canAcceptScopeCard(c)) return c;
          const admin = new Set(next.adminCompletedMilestones ?? []);
          admin.add("scope-confirmed");
          next = {
            ...next,
            scopePricingConfirmedAt: new Date().toISOString(),
            completedSteps: [...c.completedSteps, "scope-pricing-confirmed"],
            adminCompletedMilestones: [...admin],
          };
        }
        next = {
          ...next,
          guidedConnections: syncGuidedConnectionsFromScope(next),
        };
        clientToExport = next;
        return next;
      })
    );

    if (!clientToExport) {
      return { ok: false, error: "Submit client onboarding before accepting the scope card." };
    }

    const exportResult = await exportScopeCardForClient(clientToExport);
    if (exportResult) return exportResult;
    return { ok: true, unchanged: true };
  }, [applyClientsUpdate, exportScopeCardForClient]);

  const toggleAdminMilestone = useCallback(
    (id: string, milestone: ClientMilestone) => {
      applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          const current = new Set(c.adminCompletedMilestones ?? []);
          const hadBuilding = current.has("building");
          if (current.has(milestone)) current.delete(milestone);
          else current.add(milestone);
          let next: Client = { ...c, adminCompletedMilestones: [...current] };
          const buildReopened =
            milestone === "building" && hadBuilding && !current.has("building");
          if (buildReopened) {
            next = {
              ...next,
              ...buildPreviewInvalidationPatch(
                next,
                "Preview approval cleared — build marked incomplete."
              ),
            };
          }
          return next;
        })
      );
    },
    [applyClientsUpdate]
  );

  const updateGuidedConnectionDemoStatus = useCallback(
    (id: string, connectionId: string, status: ConnectionDemoStatus) => {
      applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          const guidedConnections = (c.guidedConnections ?? []).map((conn) => {
            if (conn.id !== connectionId) return conn;
            const next = { ...conn, demoStatus: status };
            if (status === "needs-attention" && !next.errorDetail) {
              next.errorDetail =
                "Simulated sync error — token refresh failed (demo only).";
            }
            if (status === "data-validated" && !next.lastSuccessfulSyncAt) {
              next.lastSuccessfulSyncAt = "2026-03-12T06:00:00.000Z";
            }
            return next;
          });
          return { ...c, guidedConnections };
        })
      );
    },
    [applyClientsUpdate]
  );

  const setPaymentOnlyPrepConfirmed = useCallback(
    (id: string, confirmed: boolean) => {
      applyClientsUpdate((base) =>
        base.map((c) =>
          c.id === id ? { ...c, paymentOnlyPrepConfirmed: confirmed } : c
        )
      );
    },
    [applyClientsUpdate]
  );

  const submitCustomerPreviewFeedback = useCallback(
    (id: string, feedback: string) => {
      const trimmed = feedback.trim();
      if (!trimmed) return false;
      const saved = applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          const note: Note = {
            id: generateId("note"),
            date: new Date().toISOString(),
            content: `Customer preview feedback: ${trimmed}`,
          };
          const admin = new Set(c.adminCompletedMilestones ?? []);
          admin.delete("client-review");
          return {
            ...c,
            previewChangeRequest: trimmed,
            previewApprovedAt: undefined,
            previewApprovedRevision: undefined,
            previewFeedbackUnresolved: true,
            adminCompletedMilestones: [...admin],
            notes: [note, ...c.notes],
          };
        })
      );
      return saved.ok;
    },
    [applyClientsUpdate]
  );

  const approveCustomerPreview = useCallback(
    (id: string) => {
      return applyClientsUpdate((base) =>
        base.map((c) => {
          if (c.id !== id) return c;
          const rev = getCurrentPreviewRevision(c);
          const note: Note = {
            id: generateId("note"),
            date: new Date().toISOString(),
            content: `Customer approved dashboard preview (revision ${rev}; no payment recorded).`,
          };
          const admin = new Set(c.adminCompletedMilestones ?? []);
          admin.add("client-review");
          return {
            ...c,
            previewApprovedAt: new Date().toISOString(),
            previewApprovedRevision: rev,
            previewChangeRequest: undefined,
            previewFeedbackUnresolved: false,
            adminCompletedMilestones: [...admin],
            notes: [note, ...c.notes],
          };
        })
      );
    },
    [applyClientsUpdate]
  );

  const markPreviewReadyForReview = useCallback((id: string) => {
    applyClientsUpdate((base) =>
      base.map((c) => {
        if (c.id !== id) return c;
        const nextRev = getCurrentPreviewRevision(c) + 1;
        const note: Note = {
          id: generateId("note"),
          date: new Date().toISOString(),
          content: `Revised preview ready for customer review (revision ${nextRev}).`,
        };
        const admin = new Set(c.adminCompletedMilestones ?? []);
        admin.delete("client-review");
        return {
          ...c,
          previewRevisionVersion: nextRev,
          previewApprovedAt: undefined,
          previewApprovedRevision: undefined,
          previewFeedbackUnresolved: false,
          previewChangeRequest: undefined,
          adminCompletedMilestones: [...admin],
          notes: [note, ...c.notes],
        };
      })
    );
  }, [applyClientsUpdate]);

  const resetToDemoData = useCallback(() => {
    const next = normalizeClients(demoClients);
    try {
      localStorage.removeItem(CLIENT_DEMO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clientsRef.current = next;
    setClients(next);
  }, []);

  const value = useMemo(
    () => ({
      clients,
      addClient,
      updateClient,
      setClientStatus,
      setOnboardingPath,
      toggleStep,
      addPayment,
      addNote,
      activateClient,
      saveOnboardingDraft,
      submitOnboarding,
      acceptScopeCard,
      toggleAdminMilestone,
      updateGuidedConnectionDemoStatus,
      setPaymentOnlyPrepConfirmed,
      submitCustomerPreviewFeedback,
      approveCustomerPreview,
      markPreviewReadyForReview,
      resetToDemoData,
    }),
    [
      clients,
      addClient,
      updateClient,
      setClientStatus,
      setOnboardingPath,
      toggleStep,
      addPayment,
      addNote,
      activateClient,
      saveOnboardingDraft,
      submitOnboarding,
      acceptScopeCard,
      toggleAdminMilestone,
      updateGuidedConnectionDemoStatus,
      setPaymentOnlyPrepConfirmed,
      submitCustomerPreviewFeedback,
      approveCustomerPreview,
      markPreviewReadyForReview,
      resetToDemoData,
    ]
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-ink-muted text-sm">Loading demo data…</p>
      </div>
    );
  }

  return (
    <ClientStoreContext.Provider value={value}>
      {children}
    </ClientStoreContext.Provider>
  );
}

export function useClientStore() {
  const ctx = useContext(ClientStoreContext);
  if (!ctx) {
    throw new Error("useClientStore must be used within ClientStoreProvider");
  }
  return ctx;
}

export { DEFAULT_SETUP_FEE, DEFAULT_MONTHLY_FEE, isOnboardingComplete };
