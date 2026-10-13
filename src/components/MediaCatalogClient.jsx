"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Film, Loader2, Sparkles, RefreshCw } from "lucide-react";
import Container from "@/components/Container";
import AnimeCard from "@/components/AnimeCard";

/**
 * Interactive paginated media catalog with bulletproof infinite scroll (lazy loading).
 * Displays items sorted from newest to oldest.
 */
export default function MediaCatalogClient({
  type = "anime",
  initialItems = [],
  title = "Katalog Anime",
  subtitle = "Daftar serial anime terbaru dengan subtitle Indonesia.",
  badge = "Anime",
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Synchronous refs to prevent stale closures during scroll events
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const sentinelRef = useRef(null);
  const seenSlugsRef = useRef(new Set(initialItems.map((i) => i.slug)));

  const isDonghua = type === "donghua";

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    const nextPage = pageRef.current + 1;

    try {
      const res = await fetch(`/api/catalog?type=${type}&page=${nextPage}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        const fresh = data.items.filter((item) => {
          if (!item || !item.slug) return false;
          if (seenSlugsRef.current.has(item.slug)) return false;
          seenSlugsRef.current.add(item.slug);
          return true;
        });

        if (fresh.length > 0) {
          setItems((prev) => [...prev, ...fresh]);
        }

        pageRef.current = nextPage;
        setPage(nextPage);

        const canLoadMore = Boolean(data.hasMore) && data.items.length > 0;
        hasMoreRef.current = canLoadMore;
        setHasMore(canLoadMore);
      } else {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (err) {
      console.warn(`[MediaCatalogClient] Error loading page ${nextPage}:`, err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [type]);

  // Dual Trigger 1: IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMore();
        }
      },
      {
        rootMargin: "450px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Dual Trigger 2: Window scroll listener (failsafe backup for all devices)
  useEffect(() => {
    let scrollTimer = null;

    function handleScroll() {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        if (loadingRef.current || !hasMoreRef.current) return;

        const scrollY = window.scrollY || window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const totalHeight = document.documentElement.scrollHeight;

        // When user scrolls within 600px of bottom, trigger next page load
        if (scrollY + viewportHeight >= totalHeight - 600) {
          loadMore();
        }
      }, 100);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loadMore]);

  return (
    <Container className="py-8 sm:py-10 pb-20">
      {/* Dynamic Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="transition-colors duration-150 hover:text-primary"
        >
          Home
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className="font-medium text-foreground">
          {isDonghua ? "Donghua" : "Anime"}
        </span>
      </nav>

      {/* Header section */}
      <div className="flex flex-col gap-3 pb-8 pt-2 sm:flex-row sm:items-end sm:justify-between border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isDonghua
                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                  : "bg-primary/15 text-primary border border-primary/30"
              }`}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {badge}
            </span>
            <span className="text-xs text-muted-foreground">
              Terbaru ke Terlama
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-end">
          <span className="text-xs font-semibold text-foreground bg-muted/70 px-3 py-1.5 rounded-md border border-border/60 shadow-sm">
            {items.length} Judul Dimuat (Hal. {page})
          </span>
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="mt-8">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-5">
            {items.map((anime, index) => (
              <AnimeCard
                key={`${anime.slug}-${index}`}
                anime={anime}
                episodeBadge={true}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <Film className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-medium text-foreground">
              Belum ada data tersedia
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Silakan periksa kembali beberapa saat lagi.
            </p>
          </div>
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="h-12 w-full mt-4" aria-hidden="true" />

      {/* Loading indicator */}
      {loading ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">
            Memuat {isDonghua ? "Donghua" : "Anime"} berikutnya dari Animasu (Lazy load)...
          </p>
        </div>
      ) : null}

      {/* Manual Button Fallback (Always functional) */}
      {hasMore && !loading && items.length > 0 ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-8 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:border-foreground/30 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            Muat Lebih Banyak
          </button>
        </div>
      ) : null}

      {/* Reached End */}
      {!hasMore && items.length > 0 ? (
        <div className="mt-12 text-center text-xs text-muted-foreground/80 border-t border-border/40 pt-6">
          ✨ Anda telah mencapai akhir daftar {isDonghua ? "Donghua" : "Anime"} ({items.length} judul).
        </div>
      ) : null}
    </Container>
  );
}
