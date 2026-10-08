"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

const LockContext = createContext<(locked: boolean) => void>(() => {});

/** Prevents accordion from collapsing while nested content is editing. */
export function PortalAccordionEditLock({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const setLocked = useContext(LockContext);
  useEffect(() => {
    setLocked(active);
    return () => setLocked(false);
  }, [active, setLocked]);
  return <>{children}</>;
}

export function PortalAccordion({
  id: idProp,
  title,
  summary,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  id?: string;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const autoId = useId();
  const panelId = idProp ?? `portal-acc-${autoId}`;
  const [open, setOpen] = useState(defaultOpen);
  const [editLocked, setEditLocked] = useState(false);

  const setLocked = useCallback((locked: boolean) => {
    setEditLocked(locked);
    if (locked) setOpen(true);
  }, []);

  const isOpen = forceOpen || editLocked || open;

  return (
    <LockContext.Provider value={setLocked}>
      <section className="rounded-xl border border-purple-100 bg-white shadow-soft">
        <h2 className="border-b border-purple-50/80">
          <button
            type="button"
            id={`${panelId}-trigger`}
            aria-expanded={isOpen}
            aria-controls={panelId}
            disabled={editLocked && isOpen}
            onClick={() => {
              if (editLocked) return;
              setOpen((v) => !v);
            }}
            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left sm:px-5 sm:py-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted sm:text-sm">
                {summary}
              </span>
            </span>
            <span
              className="mt-0.5 shrink-0 text-purple"
              aria-hidden
            >
              {isOpen ? "−" : "+"}
            </span>
          </button>
        </h2>
        {isOpen && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={`${panelId}-trigger`}
            className="border-t border-purple-50 px-4 py-4 sm:px-5"
          >
            {children}
          </div>
        )}
      </section>
    </LockContext.Provider>
  );
}
