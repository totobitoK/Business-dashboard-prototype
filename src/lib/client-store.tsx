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
import {
  canActivateClient,
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

const STORAGE_KEY = "client-operations-demo-data";

interface ClientStoreContextValue {
  clients: Client[];
  addClient: (data: ClientFormData) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  setClientStatus: (id: string, status: ClientStatus) => void;
  setOnboardingPath: (id: string, path: OnboardingPath) => void;
  toggleStep: (id: string, step: OnboardingStep) => void;
  addPayment: (
    id: string,
    amount: number,
    type: PaymentType,
    note?: string
  ) => void;
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
  submitCustomerPreviewFeedback: (id: string, feedback: string) => void;
  approveCustomerPreview: (id: string) => void;
  resetToDemoData: () => void;
}

const ClientStoreContext = createContext<ClientStoreContextValue | null>(null);

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function mergeMissingDemoClients(loaded: Client[]): Client[] {
  const ids = new Set(loaded.map((c) => c.id));
  const missing = demoClients.filter((c) => !ids.has(c.id));
  if (missing.length === 0) return loaded;
  return [...loaded, ...missing];
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

export function ClientStoreProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>(demoClients);
  const [hydrated, setHydrated] = useState(false);
  const clientsRef = useRef(clients);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  const persistScopeCardResult = useCallback(
    (id: string, result: ScopeCardExportResult) => {
      if (!result.ok || !result.card) return;
      setClients((prev) =>
        prev.map((c) =>
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
    []
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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Client[];
        setClients(normalizeClients(mergeMissingDemoClients(parsed)));
      } else {
        setClients(normalizeClients(demoClients));
      }
    } catch {
      setClients(normalizeClients(demoClients));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients, hydrated]);

  const updateClient = useCallback(
    (id: string, updates: Partial<Client>) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          let next: Client = { ...c, ...updates };
          if ("acceptedSourcesIn" in updates) {
            next = {
              ...next,
              guidedConnections: syncGuidedConnectionsFromScope(next),
            };
          }
          return next;
        })
      );
      if (touchesScopeCardFields(updates)) {
        queueScopeCardSync(id);
      }
    },
    [queueScopeCardSync]
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
    setClients((prev) => [...prev, newClient]);
    return newClient;
  }, []);

  const setClientStatus = useCallback(
    (id: string, status: ClientStatus) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          if (status === "active") {
            if (!canActivateClient(c) && c.status === "pending") return c;
            return {
              ...c,
              status: "active",
              subscriptionActive: true,
              completedSteps: getStepsForPath(c.onboardingPath),
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
    [queueScopeCardSync]
  );

  const setOnboardingPath = useCallback((id: string, path: OnboardingPath) => {
    setClients((prev) =>
      prev.map((c) => {
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
  }, []);

  const toggleStep = useCallback((id: string, step: OnboardingStep) => {
    setClients((prev) =>
      prev.map((c) => {
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
  }, []);

  const addPayment = useCallback(
    (id: string, amount: number, type: PaymentType, note?: string) => {
      const payment: Payment = {
        id: generateId("pay"),
        date: new Date().toISOString(),
        amount,
        type,
        note,
      };
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          return syncSetupPayment({
            ...c,
            payments: [...c.payments, payment],
          });
        })
      );
      queueScopeCardSync(id);
    },
    [queueScopeCardSync]
  );

  const addNote = useCallback((id: string, content: string) => {
    const note: Note = {
      id: generateId("note"),
      date: new Date().toISOString(),
      content,
    };
    setClients((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, notes: [...c.notes, note] } : c
      )
    );
  }, []);

  const activateClient = useCallback(
    (id: string) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id || !canActivateClient(c)) return c;
          return {
            ...c,
            status: "active",
            subscriptionActive: true,
            completedSteps: getStepsForPath(c.onboardingPath),
          };
        })
      );
      queueScopeCardSync(id);
    },
    [queueScopeCardSync]
  );

  const saveOnboardingDraft = useCallback(
    (id: string, draft: ClientOnboardingDraft) => {
      setClients((prev) =>
        prev.map((c) =>
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
    []
  );

  const submitOnboarding = useCallback(
    (id: string, answers: ClientOnboardingAnswers) => {
      const full = toFullAnswers(answers);
      const submittedAt = new Date().toISOString();
      let submittedClient: Client | undefined;

      setClients((prev) =>
        prev.map((c) => {
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
          return submittedClient;
        })
      );

      if (submittedClient) {
        void exportScopeCardForClient(submittedClient);
      }
    },
    [exportScopeCardForClient]
  );

  const acceptScopeCard = useCallback(async (id: string): Promise<ScopeCardExportResult> => {
    let clientToExport: Client | undefined;

    setClients((prev) =>
      prev.map((c) => {
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
  }, [exportScopeCardForClient]);

  const toggleAdminMilestone = useCallback(
    (id: string, milestone: ClientMilestone) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const current = new Set(c.adminCompletedMilestones ?? []);
          if (current.has(milestone)) current.delete(milestone);
          else current.add(milestone);
          return { ...c, adminCompletedMilestones: [...current] };
        })
      );
    },
    []
  );

  const updateGuidedConnectionDemoStatus = useCallback(
    (id: string, connectionId: string, status: ConnectionDemoStatus) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const guidedConnections = (c.guidedConnections ?? []).map((conn) =>
            conn.id === connectionId ? { ...conn, demoStatus: status } : conn
          );
          return { ...c, guidedConnections };
        })
      );
    },
    []
  );

  const setPaymentOnlyPrepConfirmed = useCallback(
    (id: string, confirmed: boolean) => {
      setClients((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, paymentOnlyPrepConfirmed: confirmed } : c
        )
      );
    },
    []
  );

  const submitCustomerPreviewFeedback = useCallback(
    (id: string, feedback: string) => {
      const trimmed = feedback.trim();
      if (!trimmed) return;
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const note: Note = {
            id: generateId("note"),
            date: new Date().toISOString(),
            content: `Customer preview feedback: ${trimmed}`,
          };
          return {
            ...c,
            previewChangeRequest: trimmed,
            previewApprovedAt: undefined,
            notes: [note, ...c.notes],
          };
        })
      );
    },
    []
  );

  const approveCustomerPreview = useCallback((id: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const admin = new Set(c.adminCompletedMilestones ?? []);
        admin.add("client-review");
        const note: Note = {
          id: generateId("note"),
          date: new Date().toISOString(),
          content: "Customer approved dashboard preview (portal — no payment recorded).",
        };
        return {
          ...c,
          previewApprovedAt: new Date().toISOString(),
          previewChangeRequest: undefined,
          adminCompletedMilestones: [...admin],
          notes: [note, ...c.notes],
        };
      })
    );
  }, []);

  const resetToDemoData = useCallback(() => {
    setClients(normalizeClients(demoClients));
    localStorage.removeItem(STORAGE_KEY);
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
