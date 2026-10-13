"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Film,
  Loader2,
  Sparkles,
  RefreshCw,
  Tv,
  Flame,
  AlertCircle,
} from "lucide-react";
import Container from "@/components/Container";
import AnimeCard from "@/components/AnimeCard";
import GenreBadge from "@/components/GenreBadge";
import SectionHeader from "@/components/SectionHeader";
import { isDonghua } from "@/lib/anime";

const SORT_OPTIONS = [
  { value: "latest", label: "Terbaru ke Terlama" },
  { value: "rating", label: "Rating Tertinggi" },
  { value: "popular", label: "Paling Populer" },
  { value: "title", label: "Judul (A-Z)" },
];

const TYPE_FILTERS = [
  { value: "all", label: "Semua (Anime & Donghua)" },
  { value: "anime", label: "Anime Saja" },
  { value: "donghua", label: "Donghua Saja" },
];

export default function GenreCatalogClient({
  genreSlug = "",
  genreName = "",
  initialItems = [],
  initialHasMore = true,
  otherGenres = [],
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedSort, setSelectedSort] = useState("latest");
  const [selectedType, setSelectedType] = useState("all");

  // Synchronous refs to prevent stale closure in scroll events & observers
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const genreSlugRef = useRef(genreSlug);

  const sentinelRef = useRef(null);
  const seenSlugsRef = useRef(new Set(initialItems.map((i) => i.slug || i.id)));

  useEffect(() => {
    genreSlugRef.current = genreSlug;
  }, [genreSlug]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setLoadError(null);

    const nextPage = pageRef.current + 1;

    try {
      const res = await fetch(
        `/api/catalog?genre=${encodeURIComponent(genreSlugRef.current)}&page=${nextPage}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        const fresh = data.items.filter((item) => {
          if (!item) return false;
          const key = item.slug || item.id;
          if (!key || seenSlugsRef.current.has(key)) return false;
          seenSlugsRef.current.add(key);
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
      console.warn(`[GenreCatalogClient] Error loading page ${nextPage}:`, err);
      setLoadError("Gagal memuat judul berikutnya. Silakan klik Coba Lagi.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Engine 1: IntersectionObserver on sentinel (refreshed when items change)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMore();
        }
      },
      {
        rootMargin: "800px", // Pre-fetch 800px before user reaches bottom
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, loadMore]);

  // Engine 2: Position-based window scroll listener (independent of footer / other genres height)
  useEffect(() => {
    let scrollTimer = null;

    function handleScroll() {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        if (loadingRef.current || !hasMoreRef.current) return;

        if (sentinelRef.current) {
          const rect = sentinelRef.current.getBoundingClientRect();
          // Trigger when sentinel is within 800px of viewport bottom
          if (rect.top <= window.innerHeight + 800) {
            loadMore();
          }
        }
      }, 80);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loadMore]);

  // Engine 3: Auto-fill viewport if screen is large and sentinel is visible on mount / update
  useEffect(() => {
    if (sentinelRef.current && hasMoreRef.current && !loadingRef.current) {
      const rect = sentinelRef.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 300) {
        loadMore();
      }
    }
  }, [items.length, loadMore]);

  // Filtering (All / Anime / Donghua) & Sorting
  const displayedItems = useMemo(() => {
    let list = items;

    // Filter by type
    if (selectedType === "donghua") {
      list = list.filter((item) => isDonghua(item));
    } else if (selectedType === "anime") {
      list = list.filter((item) => !isDonghua(item));
    }

    const sorted = [...list];
    switch (selectedSort) {
      case "rating":
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "popular":
        sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
      case "title":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "latest":
      default:
        // Naturally ordered from newest update to oldest by the scraper
        break;
    }

    return sorted;
  }, [items, selectedType, selectedSort]);

  const animeCount = useMemo(() => items.filter((i) => !isDonghua(i)).length, [items]);
  const donghuaCount = useMemo(() => items.filter((i) => isDonghua(i)).length, [items]);

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
        <Link
          href="/#genres"
          className="transition-colors duration-150 hover:text-primary"
        >
          Genre
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className="font-medium text-foreground">{genreName}</span>
      </nav>

      {/* Header section */}
      <div className="flex flex-col gap-4 pb-6 pt-2 sm:flex-row sm:items-end sm:justify-between border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Genre {genreName}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Flame className="h-2.5 w-2.5 text-amber-500" />
              Terbaru ke Terlama
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {genreName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Daftar serial anime dan donghua genre {genreName} terlengkap subtitle Indonesia, terurut otomatis dari update terbaru hingga terlama dengan lazy loading tanpa batas.
          </p>
        </div>

        {/* Counter and Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-end pt-2 sm:pt-0">
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-border/80 focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Urutan"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <span className="text-xs font-semibold text-foreground bg-muted/70 px-3 py-2 rounded-lg border border-border/60 shadow-sm">
            {displayedItems.length} Judul Dimuat (Hal. {page})
          </span>
        </div>
      </div>

      {/* Filter Tabs: Semua / Anime / Donghua */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-border/40 pb-4">
        {TYPE_FILTERS.map((tab) => {
          const isActive = selectedType === tab.value;
          const count =
            tab.value === "all"
              ? items.length
              : tab.value === "anime"
              ? animeCount
              : donghuaCount;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedType(tab.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
              }`}
            >
              {tab.value === "donghua" ? (
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              ) : tab.value === "anime" ? (
                <Tv className="h-3 w-3" />
              ) : null}
              {tab.label}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Cards */}
      <div className="mt-6">
        {displayedItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-5">
            {displayedItems.map((anime, index) => (
              <AnimeCard
                key={`${anime.slug || anime.id}-${index}`}
                anime={anime}
                episodeBadge={true}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <Film className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-medium text-foreground">
              Tidak ada judul untuk kategori ini
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedType !== "all"
                ? `Belum ditemukan ${selectedType === "donghua" ? "donghua" : "anime"} pada halaman yang termuat. Gulir ke bawah untuk memuat halaman berikutnya.`
                : `Belum ada judul untuk genre ${genreName}.`}
            </p>
          </div>
        )}
      </div>

      {/* Infinite Scroll Sentinel (Target for BoundingRect and Observer) */}
      <div
        ref={sentinelRef}
        id="genre-scroll-sentinel"
        className="h-16 w-full mt-4 flex items-center justify-center"
        aria-hidden="true"
      />

      {/* Loading indicator */}
      {loading ? (
        <div className="mt-2 flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">
            Memuat judul {genreName} halaman {page + 1} (Lazy loading otomatis)...
          </p>
        </div>
      ) : null}

      {/* Error state */}
      {loadError && !loading ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
          <div className="flex items-center gap-2 text-destructive text-xs font-semibold">
            <AlertCircle className="h-4 w-4" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadMore}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-3 w-3" />
            Coba Lagi
          </button>
        </div>
      ) : null}

      {/* Manual Button Fallback (Always functional for any browser or manual clicks) */}
      {hasMore && !loading && displayedItems.length > 0 ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-8 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:border-foreground/30 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            Muat Lebih Banyak Judul ({genreName} Hal. {page + 1})
          </button>
        </div>
      ) : null}

      {/* Reached End */}
      {!hasMore && displayedItems.length > 0 ? (
        <div className="mt-12 text-center text-xs text-muted-foreground/80 border-t border-border/40 pt-6">
          ✨ Semua judul untuk genre {genreName} telah selesai dimuat ({items.length} total judul).
        </div>
      ) : null}

      {/* Other Genres Section */}
      {otherGenres.length > 0 ? (
        <section aria-labelledby="other-genres" className="mt-16 sm:mt-20 border-t border-border/50 pt-10">
          <SectionHeader
            title="Jelajahi Genre Lainnya"
            subtitle="Temukan anime dan donghua dengan tema menarik lainnya"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {otherGenres.map((g) => (
              <GenreBadge key={g.name} genre={g.name} className="px-3.5 py-1.5" />
            ))}
          </div>
        </section>
      ) : null}
    </Container>
  );
}
