"use client";

import { useState } from "react";
import { PlayCircle, Server, Download, ExternalLink, ShieldCheck } from "lucide-react";

/**
 * Rich VideoPlayer component.
 * Embeds stream servers in an HTML <iframe> so videos can actually be played.
 * Supports multiple server switches (Server 1, Server 2, etc.) and download mirrors.
 */
export default function VideoPlayer({
  embedUrl,
  streams = [],
  downloads = [],
  poster,
  title,
  children,
}) {
  // Filter streams that have an embed_url or fallback
  const validStreams = Array.isArray(streams)
    ? streams.filter((s) => s.embed_url || s.direct_stream)
    : [];

  // Determine initial stream
  const initialIndex = Math.max(
    0,
    validStreams.findIndex((s) => s.embed_url === embedUrl)
  );
  const [selectedServerIndex, setSelectedServerIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0
  );

  const currentStream = validStreams[selectedServerIndex];
  const activeUrl = currentStream?.embed_url || embedUrl || "";

  return (
    <div className="space-y-4">
      {/* Server selector pills */}
      {validStreams.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
            <Server className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Pilih Server:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {validStreams.map((stream, idx) => {
              const isSelected = idx === selectedServerIndex;
              const serverLabel =
                stream.server_name || `Server ${idx + 1}`;
              return (
                <button
                  key={`${stream.server_name}-${idx}`}
                  type="button"
                  onClick={() => setSelectedServerIndex(idx)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"
                  }`}
                  aria-pressed={isSelected}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-emerald-500"
                    }`}
                  />
                  {serverLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Main Video Screen Container */}
      <div
        id="anime-video-player-container"
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-950 shadow-xl ring-1 ring-border/60"
      >
        {activeUrl ? (
          <iframe
            key={activeUrl}
            src={activeUrl}
            title={title ? `Player — ${title}` : "Anime Video Player"}
            className="h-full w-full border-0 bg-neutral-950"
            referrerPolicy="no-referrer"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
            <PlayCircle
              className="h-12 w-12 text-neutral-600"
              aria-hidden="true"
            />
            <div className="max-w-md">
              <p className="text-base font-medium text-neutral-200">
                Pemutar Video Sedang Menyiapkan Stream
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Sumber video untuk episode ini sedang dimuat atau sedang tidak
                tersedia langsung. Silakan coba pilih server lain atau gunakan
                link unduhan di bawah.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stream Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          <span>
            {currentStream?.server_name
              ? `Tersambung ke ${currentStream.server_name}`
              : "Stream Player Aktif"}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground/80">
          Tip: Gunakan ad-blocker jika server eksternal menampilkan pop-up.
        </div>
      </div>

      {/* Children slot (WatchProgressTracker) */}
      {children}

      {/* Download Mirrors Section (if available) */}
      {downloads && downloads.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Download className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Download Episode:</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {downloads.map((dl, idx) => (
              <a
                key={`${dl.out_url}-${idx}`}
                href={dl.direct_url || dl.out_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span>{dl.server_name || `Mirror ${idx + 1}`}</span>
                {dl.quality ? (
                  <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary">
                    {dl.quality}
                  </span>
                ) : null}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
