"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { History, X, Clock, Play, Trash2, ChevronRight, CheckCircle2 } from "lucide-react";
import { getWatchHistoryList, removeWatchEntry, clearWatchHistory } from "@/lib/watchHistory";

export default function WatchHistoryModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const dropdownRef = useRef(null);

  const loadList = () => {
    setHistoryList(getWatchHistoryList());
  };

  useEffect(() => {
    loadList();
    const handleUpdate = () => loadList();
    window.addEventListener("miru:watch_progress_updated", handleUpdate);
    return () => window.removeEventListener("miru:watch_progress_updated", handleUpdate);
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Tutup dengan tombol Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Pemicu di Navbar dengan Badge Notifikasi Mengambang */}
      <button
        type="button"
        onClick={() => {
          loadList();
          setIsOpen((prev) => !prev);
        }}
        title="Riwayat Tontonan & Lanjutkan"
        className="relative inline-flex h-9 w-9 sm:w-auto sm:px-2.5 items-center justify-center sm:gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Riwayat Nonton"
        aria-expanded={isOpen}
      >
        <History className="h-4 w-4" />
        <span className="hidden lg:inline font-medium">Riwayat</span>

        {/* Badge Notif Angka Terapung di Sudut Kanan Atas */}
        {historyList.length > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-background animate-in zoom-in-75 duration-150">
            {historyList.length > 9 ? "9+" : historyList.length}
          </span>
        ) : null}
      </button>

      {/* Backdrop redup khusus tampilan mobile agar fokus dan mudah ditutup */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Popover Card: Rapi di Tengah Mobile (fixed) dan Menempel di Desktop (absolute) */}
      {isOpen && (
        <div className="fixed inset-x-3.5 top-16 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-card/98 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-none animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Popover */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground leading-none">
                  Riwayat Nonton
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Lanjutkan tontonan terakhirmu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {historyList.length > 0 ? (
                <button
                  type="button"
                  onClick={clearWatchHistory}
                  title="Hapus Semua Riwayat"
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center gap-1 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Hapus</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Daftar Riwayat Tontonan */}
          <div className="mt-3 max-h-[65vh] sm:max-h-80 overflow-y-auto space-y-2.5 pr-1 scrollbar-slim">
            {historyList.length > 0 ? (
              historyList.map((item) => (
                <div
                  key={item.slug}
                  className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-2.5 transition-all duration-150 hover:border-primary/40 hover:bg-accent/40"
                >
                  {/* Thumbnail Poster dengan overlay play icon */}
                  <Link
                    href={item.url || `/watch/${item.slug}/${item.episode}`}
                    onClick={() => setIsOpen(false)}
                    className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/40"
                  >
                    {item.poster ? (
                      <Image
                        src={item.poster}
                        alt={item.title}
                        fill
                        sizes="48px"
                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                        <Play className="h-4 w-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-4 w-4 fill-white text-white ml-0.5" />
                    </div>
                  </Link>

                  {/* Info Judul & Waktu Menit */}
                  <div className="flex flex-1 flex-col min-w-0 pr-6">
                    <Link
                      href={item.url || `/watch/${item.slug}/${item.episode}`}
                      onClick={() => setIsOpen(false)}
                      className="truncate text-xs font-semibold text-foreground transition-colors hover:text-primary"
                      title={item.title}
                    >
                      {item.title}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-primary/10 px-1.5 py-0.2 font-bold text-primary">
                        Ep {item.episode}
                      </span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="flex items-center gap-1 font-mono text-muted-foreground">
                        <Clock className="h-3 w-3 text-primary" />
                        {item.progressText || "00:00"}
                      </span>
                    </div>

                    <Link
                      href={item.url || `/watch/${item.slug}/${item.episode}`}
                      onClick={() => setIsOpen(false)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Lanjutkan</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Tombol Hapus per Item */}
                  <button
                    type="button"
                    onClick={() => removeWatchEntry(item.slug)}
                    title="Hapus anime ini dari riwayat"
                    className="absolute right-2 top-2 p-1 text-muted-foreground/50 hover:bg-muted hover:text-destructive rounded transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Clock className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="font-semibold text-foreground">Belum ada riwayat tontonan</p>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-[240px] mx-auto">
                  Anime dan donghua yang kamu tonton akan otomatis tercatat di sini.
                </p>
              </div>
            )}
          </div>

          {/* Footer Popover */}
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Otomatis Tersimpan di Cookie
            </span>
            <span>{historyList.length} Anime</span>
          </div>
        </div>
      )}
    </div>
  );
}
