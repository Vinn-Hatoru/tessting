"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Clock, X, ChevronRight, Bookmark } from "lucide-react";
import { getWatchHistoryList, removeWatchEntry } from "@/lib/watchHistory";
import SectionHeader from "@/components/SectionHeader";

/**
 * Komponen Lanjutkan Menonton untuk Halaman Utama.
 * Menampilkan daftar anime/donghua yang terakhir ditonton berserta episode & menitnya
 * yang dibaca dari Cookie browser (miru_watch_history).
 */
export default function ContinueWatchingSection() {
  const [historyList, setHistoryList] = useState([]);
  const [mounted, setMounted] = useState(false);

  const loadHistory = () => {
    const list = getWatchHistoryList();
    setHistoryList(list);
  };

  useEffect(() => {
    setMounted(true);
    loadHistory();

    const handleUpdate = () => loadHistory();
    window.addEventListener("miru:watch_progress_updated", handleUpdate);
    return () => window.removeEventListener("miru:watch_progress_updated", handleUpdate);
  }, []);

  if (!mounted || historyList.length === 0) return null;

  return (
    <section aria-labelledby="continue-watching-heading" className="pt-8 sm:pt-10">
      <SectionHeader
        title="Lanjutkan Menonton"
        subtitle="Lanjutkan episode dan menit terakhir yang kamu tonton"
      />

      <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {historyList.slice(0, 8).map((item) => (
          <div
            key={item.slug}
            className="group relative flex overflow-hidden rounded-xl border border-border bg-card p-2.5 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
          >
            {/* Thumbnail Poster */}
            <Link
              href={item.url || `/watch/${item.slug}/${item.episode}`}
              className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/40"
            >
              {item.poster ? (
                <Image
                  src={item.poster}
                  alt={item.title}
                  fill
                  sizes="80px"
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                  <Play className="h-6 w-6" />
                </div>
              )}

              {/* Play Overlay Icon */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </div>
              </div>

              {item.isDonghua ? (
                <span className="absolute bottom-1 left-1 rounded bg-amber-500 px-1 py-0.2 text-[9px] font-bold text-neutral-950">
                  Donghua
                </span>
              ) : null}
            </Link>

            {/* Content Details */}
            <div className="ml-3 flex flex-1 flex-col justify-between min-w-0 pr-6">
              <div>
                <Link
                  href={item.url || `/watch/${item.slug}/${item.episode}`}
                  className="line-clamp-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary"
                  title={item.title}
                >
                  {item.title}
                </Link>

                <div className="mt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-[11px] text-primary">
                    Episode {item.episode}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                    <Clock className="h-3 w-3" />
                    Menit {item.progressText || "00:00"}
                  </span>
                </div>
              </div>

              {/* Quick Resume Link */}
              <div className="mt-2 flex items-center justify-between">
                <Link
                  href={item.url || `/watch/${item.slug}/${item.episode}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span>Lanjutkan</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => removeWatchEntry(item.slug)}
              title="Hapus dari riwayat"
              className="absolute right-2 top-2 h-6 w-6 rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
