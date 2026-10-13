import Link from "next/link";
import { genreLink } from "@/lib/anime";

/**
 * Small clickable genre pill linking to the genre page.
 */
export default function GenreBadge({ genre, className = "" }) {
  if (!genre) return null;
  return (
    <Link
      href={genreLink(genre)}
      className={`inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground ${className}`}
    >
      {genre}
    </Link>
  );
}
