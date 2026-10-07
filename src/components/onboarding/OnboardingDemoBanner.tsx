export function OnboardingDemoBanner() {
  return (
    <div className="fixed left-0 right-0 top-0 z-30 border-b border-purple-100 bg-purple-50/80 px-4 py-2.5 backdrop-blur-sm">
      <p className="mx-auto max-w-2xl text-center text-xs text-ink-muted sm:text-sm">
        <span className="font-medium text-ink">Local demo access</span> — no
        magic-link sign-in yet. Progress saves only in this browser, not on
        other devices. We did not send email.
      </p>
    </div>
  );
}
