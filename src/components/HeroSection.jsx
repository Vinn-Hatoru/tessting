"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Star, ChevronLeft, ChevronRight, Info } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatRating, getItemLink, isDonghua } from "@/lib/anime";

/**
 * Clean Editorial / Apple TV-inspired Spotlight Hero.
 * Highly curated, typography-first aesthetic with natural HD poster showcase,
 * refined micro-interactions, and unobtrusive navigation.
 */
export default function HeroSection({ items = [] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const total = items.length;

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Subtle auto-advance every 7s, paused when hovering
  useEffect(() => {
    if (total <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 7000);
    return () => clearInterval(timer);
  }, [total, isPaused, nextSlide]);

  const anime = items[index];
  if (!anime) return null;

  const genres = Array.isArray(anime.genres)
    ? anime.genres.filter((g) => g && g.toLowerCase() !== "genre").slice(0, 3)
    : [];

  const detailHref = anime.urlPath || getItemLink(anime);
  const isDonghuaItem = isDonghua(anime);

  return (
    <section
      aria-label="Editor's Spotlight"
      className="mx-auto w-full max-w-7xl min-w-0 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden isolate rounded-2xl sm:rounded-3xl border border-border/70 bg-gradient-to-br from-card/90 via-card/50 to-background/95 p-4 sm:p-8 md:p-10 lg:p-12 shadow-sm backdrop-blur-xl transition-colors duration-300">
        {/* Soft Ambient Poster Hue (Restrained & Elegant) */}
        <div
          key={`ambient-${anime.slug}`}
          className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl transition-opacity duration-700"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col-reverse items-center justify-between gap-6 sm:gap-8 md:flex-row md:items-center md:gap-12 min-w-0">
          {/* Left Column: Curated Info & Actions */}
          <div className="w-full flex-1 max-w-2xl min-w-0">
            {/* Eyebrow Label & Status */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Editor&apos;s Spotlight
              </span>
              {isDonghuaItem ? (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500 border border-amber-500/30">
                  Donghua 🇨🇳
                </span>
              ) : null}
              <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
              <StatusBadge status={anime.status} variant="pill" />
            </div>

            {/* Display Title */}
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl leading-[1.18] break-words">
              {anime.title}
            </h1>

            {/* Editorial Metadata Bar */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-muted-foreground font-medium">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                {formatRating(anime.rating)}
              </span>
              <span className="text-border" aria-hidden="true">·</span>
              <span>{anime.year || "2024"}</span>
              <span className="text-border" aria-hidden="true">·</span>
              <span>
                {anime.type === "Movie"
                  ? "Movie"
                  : anime.episodes > 0
                  ? `${anime.episodes} eps`
                  : anime.status === "Ongoing"
                  ? "Ongoing"
                  : "Series"}
              </span>
              {anime.studio && anime.studio !== "Animation Studio" ? (
                <>
                  <span className="text-border" aria-hidden="true">·</span>
                  <span className="text-foreground/80">{anime.studio}</span>
                </>
              ) : null}
            </div>

            {/* Genre Pills */}
            {genres.length > 0 ? (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-border/80 bg-muted/60 px-3 py-0.5 text-xs font-medium text-foreground/80 transition-colors"
                  >
                    {g}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Synopsis */}
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {anime.synopsis}
            </p>

            {/* Actions: Apple TV-style Pill Buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={`/watch/${anime.slug}/1`}
                className="inline-flex h-11 items-center gap-2.5 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Watch Now
              </Link>
              <Link
                href={detailHref}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-5 text-sm font-medium text-foreground transition-all duration-200 hover:bg-muted hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Details
              </Link>
            </div>

            {/* Minimalist Apple-style Slide Navigation */}
            {total > 1 ? (
              <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4 pt-1 min-w-0">
                {/* Arrow Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Previous spotlight title"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition-all duration-150 hover:bg-muted hover:scale-105 active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Next spotlight title"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition-all duration-150 hover:bg-muted hover:scale-105 active:scale-95"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center gap-1.5">
                  {items.map((item, i) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Go to ${item.title}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === index
                          ? "w-6 bg-primary"
                          : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                      }`}
                    />
                  ))}
                </div>

                {/* Slide Count */}
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  <span className="font-semibold text-foreground">0{index + 1}</span> / 0{total}
                </span>
              </div>
            ) : null}
          </div>

          {/* Right Column: Crisp Showcase Poster */}
          <div className="relative shrink-0">
            <Link
              href={detailHref}
              className="group block relative"
              tabIndex={-1}
              aria-label={`View ${anime.title}`}
            >
              <div className="relative aspect-[2/3] w-[190px] sm:w-[230px] md:w-[250px] lg:w-[280px] overflow-hidden rounded-2xl ring-1 ring-border/80 shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-primary/40">
                <Image
                  key={`poster-${anime.slug}`}
                  src={anime.poster}
                  alt={`${anime.title} poster`}
                  fill
                  priority
                  sizes="(max-width: 640px) 190px, (max-width: 1024px) 250px, 280px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {/* Subtle sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/5 opacity-50 transition-opacity duration-300 group-hover:opacity-20" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
