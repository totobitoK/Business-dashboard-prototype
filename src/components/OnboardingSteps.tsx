import type { Client } from "@/lib/types";
import {
  getStepState,
  getStepsForPath,
  STEP_LABELS,
} from "@/lib/onboarding";

export function OnboardingStepsDisplay({
  client,
  interactive = false,
  onToggleStep,
}: {
  client: Client;
  interactive?: boolean;
  onToggleStep?: (step: ReturnType<typeof getStepsForPath>[number]) => void;
}) {
  const steps = getStepsForPath(client.onboardingPath);
  const journeyComplete =
    client.status === "active" ||
    steps.every((s) => client.completedSteps.includes(s));

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const state = getStepState(client, step);
        const isLast = index === steps.length - 1;

        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 ${
                  state === "completed" ? "bg-purple" : "bg-purple-200"
                }`}
                aria-hidden
              />
            )}
            <StepIndicator state={state} />
            <div className="min-w-0 flex-1 pt-0.5">
              {interactive && client.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => onToggleStep?.(step)}
                  disabled={state === "upcoming"}
                  className={`text-left text-sm font-medium transition-colors ${
                    state === "completed"
                      ? "text-navy-muted line-through"
                      : state === "current"
                        ? "text-navy"
                        : "cursor-not-allowed text-navy-muted/50"
                  } ${state !== "upcoming" ? "hover:text-navy-light" : ""}`}
                >
                  {STEP_LABELS[step]}
                </button>
              ) : (
                <p
                  className={`text-sm font-medium ${
                    state === "completed"
                      ? "text-navy-muted"
                      : state === "current"
                        ? "text-navy"
                        : "text-navy-muted/60"
                  }`}
                >
                  {STEP_LABELS[step]}
                </p>
              )}
              <p className="mt-0.5 text-xs capitalize text-navy-muted">
                {state === "completed"
                  ? "Completed"
                  : state === "current"
                    ? "Current step"
                    : "Upcoming"}
              </p>
            </div>
          </li>
        );
      })}
      {journeyComplete && (
        <li className="relative flex gap-3 pt-1">
          <StepIndicator
            state={client.status === "active" ? "completed" : "current"}
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p
              className={`text-sm font-medium ${
                client.status === "active" ? "text-navy-muted" : "text-navy"
              }`}
            >
              {client.status === "active" ? "Active" : "Launch"}
            </p>
            <p className="mt-0.5 text-xs text-navy-muted">
              {client.status === "active"
                ? "Completed — dashboard live"
                : "Current — activate when milestones are met"}
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}

function StepIndicator({
  state,
}: {
  state: "completed" | "current" | "upcoming";
}) {
  if (state === "completed") {
    return (
      <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple text-white">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-purple bg-white">
        <span className="h-2 w-2 rounded-full bg-purple" />
      </span>
    );
  }
  return (
    <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-purple-200 bg-white">
      <span className="h-2 w-2 rounded-full bg-purple-200" />
    </span>
  );
}
