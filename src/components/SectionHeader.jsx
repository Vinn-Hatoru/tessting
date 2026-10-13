import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Section heading with optional "View all" style action link.
 */
export default function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "View all",
  className = "",
}) {
  return (
    <div className={`mb-5 flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group/link inline-flex shrink-0 items-center gap-1 pb-0.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
        >
          {linkLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover/link:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
