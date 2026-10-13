import Link from "next/link";
import { Play } from "lucide-react";
import Container from "@/components/Container";
import { genreLink } from "@/lib/anime";

const BROWSE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/#trending", label: "Trending" },
  { href: "/#latest", label: "Latest Episodes" },
];

const FEATURED_GENRES = [
  "Action",
  "Romance",
  "Fantasy",
  "Comedy",
  "Sci-Fi",
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card/60">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Play
                  className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground"
                  aria-hidden="true"
                />
              </span>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Miru
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A clean, modern way to browse and stream anime. Follow trending
              titles, catch the latest episodes, and discover something new by
              genre.
            </p>
            <p className="mt-4 text-xs text-muted-foreground/80">
              Demo project — every title, studio, and episode is fictional.
            </p>
          </div>

          {/* Browse */}
          <nav aria-label="Browse">
            <h2 className="text-sm font-semibold text-foreground">Browse</h2>
            <ul className="mt-3 space-y-2.5">
              {BROWSE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors duration-200 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Genres */}
          <nav aria-label="Genres">
            <h2 className="text-sm font-semibold text-foreground">Genres</h2>
            <ul className="mt-3 space-y-2.5">
              {FEATURED_GENRES.map((genre) => (
                <li key={genre}>
                  <Link
                    href={genreLink(genre)}
                    className="text-sm text-muted-foreground transition-colors duration-200 hover:text-primary"
                  >
                    {genre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Miru. All rights reserved.</p>
          <p>Built with Next.js — data is for demonstration only.</p>
        </div>
      </Container>
    </footer>
  );
}
