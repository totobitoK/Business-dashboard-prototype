import { formatCurrency, formatCurrencyDetailed } from "@/lib/metrics";

export const currencyAmountClass = "font-medium text-purple";

export function CurrencyAmount({
  amount,
  detailed = false,
  prefix = "",
  className = "",
}: {
  amount: number;
  detailed?: boolean;
  prefix?: string;
  className?: string;
}) {
  const text = detailed
    ? formatCurrencyDetailed(amount)
    : formatCurrency(amount);

  return (
    <span className={`${currencyAmountClass}${className ? ` ${className}` : ""}`}>
      {prefix}
      {text}
    </span>
  );
}

const CURRENCY_IN_TEXT = /(\$[\d,]+(?:\.\d{2})?)/g;

/** Highlights dollar amounts embedded in plain text. */
export function TextWithCurrency({ text }: { text: string }) {
  const parts = text.split(CURRENCY_IN_TEXT);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("$") ? (
          <span key={i} className={currencyAmountClass}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
