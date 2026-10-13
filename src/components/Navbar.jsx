"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Play, Search, X } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import WatchHistoryModal from "@/components/WatchHistoryModal";

const NAV_LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/anime", label: "Anime" },
  { href: "/donghua", label: "Donghua" },
  { href: "/#trending", label: "Trending" },
  { href: "/#latest", label: "Latest" },
  { href: "/#genres", label: "Genres" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href, exact) {
    if (exact) return pathname === href;
    if (href.startsWith("/#")) return false;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <Container>
        <div className="flex h-16 items-center gap-2 sm:gap-5 min-w-0">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
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

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    aria-current={
                      isActive(link.href, link.exact) ? "page" : undefined
                    }
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive(link.href, link.exact)
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1" />

          {/* Desktop search + theme toggle + sign in */}
          <div className="hidden md:block md:w-52 lg:w-60">
            <SearchBar variant="nav" />
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <WatchHistoryModal />
            <ThemeToggle />
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-1 sm:hidden">
            <WatchHistoryModal />
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <Link
              href="/search"
              onClick={() => setMenuOpen(false)}
              aria-label="Search anime"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </Container>

      {/* Mobile menu */}
      {menuOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-border/80 bg-background md:hidden"
        >
          <Container className="space-y-4 py-4">
            <SearchBar variant="nav" />
            <nav aria-label="Mobile navigation">
              <ul className="space-y-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(link.href, link.exact)
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground/90 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Tema Tampilan
              </div>
              <ThemeToggle variant="segmented" />
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
