"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  SearchX,
  Loader2,
  Sparkles,
  ArrowRight,
  X,
  RefreshCw,
} from "lucide-react";
import Container from "@/components/Container";
import AnimeCard from "@/components/AnimeCard";
import EmptyState from "@/components/EmptyState";
import { getGenres } from "@/lib/anime";

const TYPE_TABS = [
  { id: "all", label: "Semua" },
  { id: "anime", label: "Anime" },
  { id: "donghua", label: "Donghua 🇨🇳" },
];

const SORT_OPTIONS = [
  { value: "latest", label: "Terbaru ke Terlama" },
  { value: "rating", label: "Rating Tertinggi" },
  { value: "popular", label: "Paling Populer" },
  { value: "title", label: "Judul (A-Z)" },
];

export default function SearchClient({
  initialQuery = "",
  initialType = "all",
  initialItems = [],
}) {
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? initialQuery;
  const rawUrlType = (searchParams.get("type") ?? initialType).toLowerCase();
  const urlType = rawUrlType === "donghua" ? "donghua" : rawUrlType === "anime" ? "anime" : "all";

  const [query, setQuery] = useState(urlQuery);
  const [selectedType, setSelectedType] = useState(urlType);
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [selectedSort, setSelectedSort] = useState("latest");

  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Synchronous refs to prevent stale closure in scroll events & observers
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const isSearchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const queryRef = useRef(urlQuery);
  const selectedTypeRef = useRef(urlType);

  const sentinelRef = useRef(null);
  const abortControllerRef = useRef(null);
  const seenSlugsRef = useRef(new Set(initialItems.map((i) => i.slug)));
  const clientCacheRef = useRef(new Map());
  const isFirstMountRef = useRef(true);

  const genres = useMemo(() => getGenres(), []);

  // Keep refs in sync with state
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);

  // Pre-seed cache with initialItems if available
  useEffect(() => {
    if (initialItems.length > 0) {
      const initialKey = `-${initialType}-1`;
      clientCacheRef.current.set(initialKey, {
        results: initialItems,
        hasMore: true,
      });
    }
  }, [initialItems, initialType]);

  // Sync state if URL search query changes via navigation
  useEffect(() => {
    const qParam = searchParams.get("q") || "";
    if (qParam !== query) {
      setQuery(qParam);
    }
    const tParam = (searchParams.get("type") || "all").toLowerCase();
    if (tParam !== selectedType) {
      setSelectedType(tParam);
    }
  }, [searchParams]);

  // Unified fetch function
  const fetchResults = useCallback(
    async (
      pageToLoad = 1,
      isNewQuery = false,
      activeQuery = queryRef.current,
      activeType = selectedTypeRef.current
    ) => {
      const qTrimmed = activeQuery.trim();
      const cacheKey = `${qTrimmed.toLowerCase()}-${activeType}-${pageToLoad}`;

      // Check client memory cache for 0ms instant display
      if (clientCacheRef.current.has(cacheKey)) {
        const cached = clientCacheRef.current.get(cacheKey);
        if (isNewQuery) {
          seenSlugsRef.current = new Set(cached.results.map((i) => i.slug));
          setItems(cached.results);
          pageRef.current = 1;
          setPage(1);
        } else {
          const fresh = cached.results.filter((item) => {
            if (!item || !item.slug) return false;
            if (seenSlugsRef.current.has(item.slug)) return false;
            seenSlugsRef.current.add(item.slug);
            return true;
          });
          setItems((prev) => [...prev, ...fresh]);
          pageRef.current = pageToLoad;
          setPage(pageToLoad);
        }
        hasMoreRef.current = Boolean(cached.hasMore);
        setHasMore(Boolean(cached.hasMore));
        isSearchingRef.current = false;
        loadingRef.current = false;
        setIsSearching(false);
        setLoading(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isNewQuery) {
        isSearchingRef.current = true;
        setIsSearching(true);
      } else {
        loadingRef.current = true;
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (qTrimmed) params.set("q", qTrimmed);
        if (activeType !== "all") params.set("type", activeType);
        params.set("page", String(pageToLoad));

        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.results)) {
          const freshResults = data.results;
          const canLoadMore = Boolean(data.hasMore) && freshResults.length > 0;

          clientCacheRef.current.set(cacheKey, {
            results: freshResults,
            hasMore: canLoadMore,
          });

          if (isNewQuery) {
            seenSlugsRef.current = new Set(freshResults.map((i) => i.slug));
            setItems(freshResults);
            pageRef.current = 1;
            setPage(1);
          } else {
            const fresh = freshResults.filter((item) => {
              if (!item || !item.slug) return false;
              if (seenSlugsRef.current.has(item.slug)) return false;
              seenSlugsRef.current.add(item.slug);
              return true;
            });

            if (fresh.length > 0) {
              setItems((prev) => [...prev, ...fresh]);
            }
            pageRef.current = pageToLoad;
            setPage(pageToLoad);
          }

          hasMoreRef.current = canLoadMore;
          setHasMore(canLoadMore);
        } else {
          if (isNewQuery) setItems([]);
          hasMoreRef.current = false;
          setHasMore(false);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("[SearchClient] Fetch error:", err);
        }
      } finally {
        isSearchingRef.current = false;
        loadingRef.current = false;
        setIsSearching(false);
        setLoading(false);
      }
    },
    []
  );

  // Trigger search when typing with 220ms debounce
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (initialItems.length > 0 && !query.trim()) {
        return;
      }
    }

    const timer = setTimeout(() => {
      fetchResults(1, true, query, selectedType);
    }, 220);

    return () => clearTimeout(timer);
  }, [query, fetchResults]);

  // Handle immediate tab click (zero debounce delay)
  function handleTypeChange(newType) {
    if (newType === selectedType) return;
    setSelectedType(newType);
    selectedTypeRef.current = newType;
    fetchResults(1, true, query, newType);
  }

  // Load next page on scroll
  const loadNextPage = useCallback(() => {
    if (loadingRef.current || isSearchingRef.current || !hasMoreRef.current) return;
    fetchResults(pageRef.current + 1, false, queryRef.current, selectedTypeRef.current);
  }, [fetchResults]);

  // Dual Trigger 1: IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current && !isSearchingRef.current) {
          loadNextPage();
        }
      },
      {
        rootMargin: "450px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage]);

  // Dual Trigger 2: Window scroll listener (failsafe backup for all browsers)
  useEffect(() => {
    let scrollTimer = null;

    function handleScroll() {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        if (loadingRef.current || isSearchingRef.current || !hasMoreRef.current) return;

        const scrollY = window.scrollY || window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const totalHeight = document.documentElement.scrollHeight;

        // When user reaches within 600px of bottom, trigger lazy load
        if (scrollY + viewportHeight >= totalHeight - 600) {
          loadNextPage();
        }
      }, 100);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loadNextPage]);

  // Client-side sorting and genre filtering
  const displayedItems = useMemo(() => {
    let list = [...items];

    if (selectedGenre !== "all") {
      list = list.filter((a) =>
        (a.genres || []).some(
          (g) => g.toLowerCase() === selectedGenre.toLowerCase()
        )
      );
    }

    switch (selectedSort) {
      case "rating":
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "popular":
        list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
      case "title":
        list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "latest":
      default:
        // Already naturally ordered from newest to oldest by the scraper API
        break;
    }

    return list;
  }, [items, selectedGenre, selectedSort]);

  function clearSearch() {
    setQuery("");
    queryRef.current = "";
    setSelectedType("all");
    selectedTypeRef.current = "all";
    setSelectedGenre("all");
    setSelectedSort("latest");
    if (initialItems.length > 0) {
      seenSlugsRef.current = new Set(initialItems.map((i) => i.slug));
      setItems(initialItems);
      pageRef.current = 1;
      setPage(1);
      hasMoreRef.current = true;
      setHasMore(true);
    } else {
      fetchResults(1, true, "", "all");
    }
  }

  return (
    <Container className="py-8 sm:py-10 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              Katalog Lengkap
            </span>
            <span className="text-xs text-muted-foreground">
              Terbaru ke Terlama
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pencarian & Katalog Anime & Donghua
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Temukan koleksi anime dan donghua terlengkap dari episode terbaru hingga judul lawas.
          </p>
        </div>

        {/* Shortcuts to dedicated catalog pages */}
        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          <Link
            href="/anime"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-muted"
          >
            Halaman Anime
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </Link>
          <Link
            href="/donghua"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-500 transition-all hover:bg-amber-500/20"
          >
            Halaman Donghua 🇨🇳
            <ArrowRight className="h-3 w-3 text-amber-500" />
          </Link>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari judul anime, donghua, atau studio..."
          aria-label="Cari anime atau donghua"
          autoFocus
          className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-10 text-base text-foreground placeholder:text-muted-foreground shadow-sm transition-all duration-150 hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Tabs & Filters Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        {/* Type Switcher Tabs (Semua / Anime / Donghua) */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-1">
          {TYPE_TABS.map((tab) => {
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTypeChange(tab.id)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Genre select */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border/80 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Semua Genre</option>
            {genres.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Sort select */}
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border/80 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Header Info */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            {query.trim() ? (
              <>
                Hasil pencarian untuk{" "}
                <span className="font-semibold text-foreground">
                  “{query.trim()}”
                </span>
              </>
            ) : (
              <>
                Menampilkan daftar{" "}
                <span className="font-semibold text-foreground">
                  {selectedType === "donghua"
                    ? "Donghua 🇨🇳"
                    : selectedType === "anime"
                    ? "Anime"
                    : "Anime & Donghua"}
                </span>{" "}
                (Terbaru ke Terlama)
              </>
            )}
          </span>
        </div>
        <span className="font-medium text-foreground/80">
          {displayedItems.length} judul termuat (Hal. {page})
        </span>
      </div>

      {/* Content Grid */}
      <div className="mt-6">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Mencari data anime & donghua...
            </p>
          </div>
        ) : displayedItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-5">
            {displayedItems.map((anime, index) => (
              <AnimeCard
                key={`${anime.slug}-${index}`}
                anime={anime}
                episodeBadge={true}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={SearchX}
            title="Tidak ada hasil ditemukan"
            description={
              query.trim()
                ? `Tidak dapat menemukan judul yang cocok dengan “${query.trim()}”. Coba kata kunci lain atau pilih tab Anime / Donghua.`
                : "Belum ada data tersedia untuk filter yang dipilih."
            }
            action={
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Reset Filter
              </button>
            }
          />
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="h-12 w-full mt-4" aria-hidden="true" />

      {/* Lazy loading indicator */}
      {loading ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">
            Memuat judul berikutnya dari Animasu (Lazy load)...
          </p>
        </div>
      ) : null}

      {/* Manual Button Fallback (Always functional) */}
      {hasMore && !loading && !isSearching && displayedItems.length > 0 ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadNextPage}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-8 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:border-foreground/30 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            Muat Lebih Banyak
          </button>
        </div>
      ) : null}

      {/* Reached End */}
      {!hasMore && displayedItems.length > 0 ? (
        <div className="mt-12 text-center text-xs text-muted-foreground/80 border-t border-border/40 pt-6">
          ✨ Semua judul telah dimuat ({displayedItems.length} hasil).
        </div>
      ) : null}
    </Container>
  );
}
