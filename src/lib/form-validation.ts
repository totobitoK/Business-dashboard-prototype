const FEE_PATTERN = /^\d+(\.\d{1,2})?$/;

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

export function validateFee(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (!FEE_PATTERN.test(trimmed)) {
    return `${label} must be a non-negative amount with at most 2 decimal places.`;
  }
  const num = parseFloat(trimmed);
  if (num < 0) return `${label} must be zero or greater.`;
  return null;
}

export function parseFee(value: string): number {
  return Math.round(parseFloat(value) * 100) / 100;
}
