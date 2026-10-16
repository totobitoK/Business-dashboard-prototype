/** Client-generated idempotency key for a single admin payment record attempt (retried until success). */
export function newSetupPaymentOperationKey(): string {
  return crypto.randomUUID();
}
