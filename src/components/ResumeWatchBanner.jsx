"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Clock, Sparkles } from "lucide-react";
import { getLastWatched } from "@/lib/watchHistory";

/**
 * Banner "Lanjutkan Menonton" khusus di halaman detail serial anime / donghua.
 * Membaca cookie secara instan di sisi klien.
 */
export default function ResumeWatchBanner({ slug, title }) {
  const [lastWatch, setLastWatch] = useState(null);

  useEffect(() => {
    if (!slug) return;
    const item = getLastWatched(slug);
    if (item && item.episode) {
      setLastWatch(item);
    }
  }, [slug]);

  if (!lastWatch) return null;

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Terakhir Ditonton
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Episode {lastWatch.episode}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-foreground flex items-center gap-1.5">
              <span>Lanjutkan menonton pada menit</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <Clock className="h-3.5 w-3.5" />
                {lastWatch.progressText || "00:00"}
              </span>
            </p>
          </div>
        </div>

        <Link
          href={lastWatch.url || `/watch/${slug}/${lastWatch.episode}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow transition-transform hover:bg-primary/90 active:scale-95"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Lanjutkan Episode {lastWatch.episode}</span>
        </Link>
      </div>
    </div>
  );
}
