"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Loader2, Star, Film, ArrowRight, X } from "lucide-react";

/**
 * High-performance search bar with instant autocomplete dropdown.
 * Built with debounce, AbortController, and client-side memory cache
 * to strictly prevent React re-render thrashing and API spam.
 */
export default function SearchBar({
  variant = "nav",
  defaultValue = "",
  autoFocus = false,
  placeholder = "Cari anime atau donghua...",
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const cacheRef = useRef(new Map());

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search results with AbortController and local memory cache
  const executeSearch = useCallback(async (searchTerm) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    if (cacheRef.current.has(cacheKey)) {
      const cachedData = cacheRef.current.get(cacheKey);
      setResults(cachedData);
      setIsOpen(true);
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && data.success && Array.isArray(data.results)) {
        cacheRef.current.set(cacheKey, data.results);
        setResults(data.results);
        setIsOpen(true);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.warn("[SearchBar] Search error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(e) {
    const nextVal = e.target.value;
    setQuery(nextVal);
    setSelectedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (nextVal.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    // Debounce by 180ms for instant feel
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(nextVal);
    }, 180);
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();
    const q = query.trim();
    setIsOpen(false);
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/search");
    }
  }

  function handleKeyDown(e) {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter") {
        handleSubmit(e);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        const target = results[selectedIndex];
        setIsOpen(false);
        const targetLink =
          target.urlPath ||
          (target.isDonghua ? `/donghua/${target.slug}` : `/anime/${target.slug}`);
        router.push(targetLink);
      } else {
        handleSubmit(e);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function clearQuery() {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  }

  const isNav = variant === "nav";

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} role="search" className="relative w-full">
        {loading ? (
          <Loader2
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-primary ${
              isNav ? "h-4 w-4" : "h-5 w-5"
            }`}
            aria-hidden="true"
          />
        ) : (
          <Search
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${
              isNav ? "h-4 w-4" : "h-5 w-5"
            }`}
            aria-hidden="true"
          />
        )}

        <input
          ref={inputRef}
          type="text"
          name="q"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0 && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label="Search anime"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className={`w-full rounded-md border border-border bg-card pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-150 hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${
            isNav ? "h-9" : "h-12 pl-11 text-base"
          }`}
        />

        {query ? (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 top-full mt-2 z-50 w-full overflow-hidden rounded-xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-md ${
            isNav ? "sm:left-auto sm:right-0 sm:w-[380px] lg:w-[420px]" : "w-full"
          }`}
        >
          {results.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span>HASIL PENCARIAN ({results.length})</span>
                <span>Gunakan ↑ ↓ navigasi</span>
              </div>

              <div className="max-h-[340px] divide-y divide-border/40 overflow-y-auto scrollbar-slim">
                {results.slice(0, 7).map((item, idx) => {
                  const isHighlighted = idx === selectedIndex;
                  return (
                    <Link
                      key={`${item.slug}-${idx}`}
                      href={item.urlPath || (item.isDonghua ? `/donghua/${item.slug}` : `/anime/${item.slug}`)}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-lg p-2 transition-colors duration-150 ${
                        isHighlighted
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/70 text-foreground"
                      }`}
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/50">
                        {item.thumbnail || item.poster ? (
                          <Image
                            src={item.thumbnail || item.poster}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <Film className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">
                          {item.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {item.score ? (
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              {item.score}
                            </span>
                          ) : null}
                          {item.episode ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {item.episode}
                            </span>
                          ) : null}
                          {item.isDonghua ? (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 border border-amber-500/30">
                              Donghua 🇨🇳
                            </span>
                          ) : item.type ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              {item.type}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="border-t border-border/60 p-1 pt-1.5">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <span>
                    Lihat semua hasil untuk “
                    <strong className="text-foreground">{query}</strong>”
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : !loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Tidak ditemukan anime dengan kata kunci “
              <span className="font-semibold text-foreground">{query}</span>”
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
