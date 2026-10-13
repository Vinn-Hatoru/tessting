const DOT_COLORS = {
  Ongoing: "bg-primary",
  Completed: "bg-emerald-500",
  Upcoming: "bg-neutral-300 dark:bg-neutral-600",
};

const PILL_STYLES = {
  Ongoing: "border-primary/30 bg-accent text-accent-foreground",
  Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  Upcoming: "border-border bg-muted/60 text-muted-foreground",
};

/**
 * Small status indicator. `variant="dot"` (default) fits inside cards,
 * `variant="pill"` reads better on detail pages.
 */
export default function StatusBadge({ status, variant = "dot" }) {
  if (!status) return null;
  const cleanStatus =
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          PILL_STYLES[cleanStatus] || PILL_STYLES.Completed
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[cleanStatus] || "bg-neutral-400"}`}
          aria-hidden="true"
        />
        {cleanStatus}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[cleanStatus] || "bg-neutral-400"}`}
        aria-hidden="true"
      />
      {cleanStatus}
    </span>
  );
}
