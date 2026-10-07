import { branding } from "@/lib/branding";
import { PageEyebrow } from "./PageEyebrow";

export function PageHeader({
  eyebrow = branding.productArea,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header>
      {eyebrow && <PageEyebrow>{eyebrow}</PageEyebrow>}
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      )}
    </header>
  );
}
