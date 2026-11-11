import Link from "next/link";
import { branding } from "@/lib/branding";

type WordmarkSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<WordmarkSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl sm:text-4xl",
};

export function RavenViewWordmark({
  size = "md",
  linked = false,
  collapsed = false,
  href = "/",
  monochrome = false,
}: {
  size?: WordmarkSize;
  linked?: boolean;
  collapsed?: boolean;
  href?: string;
  monochrome?: boolean;
}) {
  const { primary, accent } = branding.wordmark;
  const accentClass = monochrome ? "text-ink" : "text-purple";

  const wordmark = collapsed ? (
    <span
      className={`flex flex-col items-center font-bold leading-none ${sizeClasses[size]}`}
      aria-label={branding.name}
    >
      <span className="text-ink">{primary.charAt(0)}</span>
      <span className={accentClass}>{accent.charAt(0)}</span>
    </span>
  ) : (
    <span
      className={`font-semibold tracking-tight ${sizeClasses[size]}`}
      aria-label={branding.name}
    >
      <span className="text-ink">{primary}</span>
      <span className={accentClass}>{accent}</span>
    </span>
  );

  if (linked) {
    return (
      <Link
        href={href}
        className={`inline-block rounded-sm transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          monochrome ? "focus-visible:outline-ink" : "focus-visible:outline-purple"
        }`}
      >
        {wordmark}
      </Link>
    );
  }

  return wordmark;
}
