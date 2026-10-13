"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Play, Clock } from "lucide-react";
import { getLastWatched } from "@/lib/watchHistory";

/**
 * Scannable episode list.
 * - `activeEpisode` gets the orange highlight.
 * - `scrollable` caps the height and scrolls (sidebar / long lists).
 * - Auto-scrolls the active episode into view on the watch page.
 * - Menampilkan indikator menit terakhir ditonton dari Cookie.
 */
export default function EpisodeList({
  anime,
  episodes = [],
  activeEpisode = null,
  scrollable = false,
  maxHeight = "430px",
  className = "",
}) {
  const activeRef = useRef(null);
  const [lastWatched, setLastWatched] = useState(null);

  useEffect(() => {
    if (anime?.slug) {
      setLastWatched(getLastWatched(anime.slug));
    }
  }, [anime?.slug]);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [activeEpisode]);

  if (!anime || !episodes.length) return null;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-card ${className}`}
    >
      <ul
        className={`divide-y divide-border/60 ${scrollable ? "scrollbar-slim overflow-y-auto" : ""}`}
        style={scrollable ? { maxHeight } : undefined}
      >
        {episodes.map((episode) => {
          const isActive = episode.number === activeEpisode;
          return (
            <li key={episode.number}>
              <Link
                href={`/watch/${anime.slug}/${episode.number}`}
                aria-current={isActive ? "page" : undefined}
                ref={isActive ? activeRef : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-accent"
                    : "hover:bg-muted/70 focus-visible:bg-muted/70"
                }`}
              >
                <span
                  className={`w-8 shrink-0 text-sm font-medium tabular-nums ${
                    isActive ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {String(episode.number).padStart(2, "0")}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    isActive
                      ? "font-medium text-accent-foreground"
                      : "text-foreground/90"
                  }`}
                >
                  {episode.title}
                  {lastWatched && Number(lastWatched.episode) === episode.number && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                      <Clock className="h-2.5 w-2.5" />
                      {lastWatched.progressText || "00:00"}
                    </span>
                  )}
                </span>
                {isActive ? (
                  <Play
                    className="h-3.5 w-3.5 shrink-0 fill-primary text-primary"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/40"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
