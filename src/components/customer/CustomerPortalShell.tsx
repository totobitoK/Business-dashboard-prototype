import type { ReactNode } from "react";

export function CustomerPortalShell({
  children,
  fillScreen = false,
}: {
  children: ReactNode;
  signOut?: boolean;
  fillScreen?: boolean;
}) {
  return (
    <main
      className={`flex min-h-0 min-w-0 flex-1 flex-col bg-white text-ink ${
        fillScreen ? "min-h-screen" : ""
      }`}
    >
      {children}
    </main>
  );
}
