import type { PaymentRecordSource } from "./types";

export const DEMO_CHECKOUT_NOTE = "Demo checkout (simulated)";

/** Human-readable payment source — never imply processor verification for demo. */
export function formatPaymentRecordSource(
  source?: PaymentRecordSource
): string {
  switch (source) {
    case "demo":
      return "Demo checkout (simulated)";
    case "online":
      return "Online (processor)";
    case "offline":
      return "Offline / manual";
    default:
      return "Offline / manual";
  }
}
