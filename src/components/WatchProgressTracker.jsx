"use client";

import { useState, useEffect, useRef } from "react";
import {
  Clock,
  Check,
  CheckCircle2,
  SlidersHorizontal,
  RotateCcw,
  X,
  Play,
  Pause,
} from "lucide-react";
import {
  getLastWatched,
  saveWatchProgress,
  formatSeconds,
  parseTimeToSeconds,
} from "@/lib/watchHistory";

/**
 * WatchProgressTracker
 * Pelacak episode & menit otomatis 100% di latar belakang (Background Cookie Sync).
 *
 * Fitur Utama:
 * 1. 100% OTOMATIS: Pengguna TIDAK PERLU menekan tombol "Mulai Timer" atau "Simpan Progres".
 * 2. Smart Detection: Mulai merekam otomatis ketika video diputar/diinteraksi atau saat menonton.
 * 3. Tab Inactivity Safe: Otomatis jeda jika pengguna berpindah tab (document.hidden) agar detik tidak membengkak.
 * 4. Silent Cookie Persistence: Menyimpan ke cookie 'miru_watch_history' secara berkala dan saat keluar halaman.
 * 5. Minimalist Glassmorphic UI: Berupa slim pill status yang elegan di bawah pemutar video.
 */
export default function WatchProgressTracker({
  slug,
  title,
  episode,
  poster,
  isDonghua = false,
}) {
  const [seconds, setSeconds] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);
  const [showAdjuster, setShowAdjuster] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState("00:00");

  const secondsRef = useRef(0);
  const isTrackingRef = useRef(false);
  const hasUserStartedRef = useRef(false);

  // 1. Inisialisasi data dari Cookie saat halaman dimuat
  useEffect(() => {
    if (!slug) return;
    const existing = getLastWatched(slug);

    if (existing && Number(existing.episode) === Number(episode)) {
      const initialSec = Number(existing.seconds) || 0;
      setSeconds(initialSec);
      secondsRef.current = initialSec;
      setCustomTimeInput(formatSeconds(initialSec));
    } else {
      setSeconds(0);
      secondsRef.current = 0;
      setCustomTimeInput("00:00");
      // Langsung daftarkan episode saat ini ke cookie secara instan
      saveWatchProgress({
        slug,
        title,
        episode: Number(episode),
        seconds: 0,
        poster,
        isDonghua,
      });
    }

    // Default status awal
    setIsTracking(false);
    isTrackingRef.current = false;
    hasUserStartedRef.current = false;
  }, [slug, episode, title, poster, isDonghua]);

  // 2. Deteksi otomatis pemutaran video (interaksi player / autoplay)
  useEffect(() => {
    let isHoveringPlayer = false;
    const playerContainer =
      document.getElementById("anime-video-player-container") ||
      document.querySelector("iframe");

    function handleMouseEnter() {
      isHoveringPlayer = true;
    }
    function handleMouseLeave() {
      isHoveringPlayer = false;
    }

    // Pengguna berinteraksi dengan iframe video player (klik play / pause)
    function handleWindowBlur() {
      if (isHoveringPlayer) {
        hasUserStartedRef.current = true;
        setIsTracking(true);
        isTrackingRef.current = true;
      }
    }

    // Tangkap interaksi sentuhan / klik pada container player
    function handlePlayerTouch() {
      hasUserStartedRef.current = true;
      setIsTracking(true);
      isTrackingRef.current = true;
    }

    // PostMessage listener (bila video player mengirimkan event play)
    function handlePostMessage(event) {
      try {
        if (!event.data) return;
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data.event === "onStateChange" ||
          data.type === "player:play" ||
          data.action === "play" ||
          data.status === "playing"
        ) {
          hasUserStartedRef.current = true;
          setIsTracking(true);
          isTrackingRef.current = true;
        }
      } catch {}
    }

    if (playerContainer) {
      playerContainer.addEventListener("mouseenter", handleMouseEnter);
      playerContainer.addEventListener("mouseleave", handleMouseLeave);
      playerContainer.addEventListener("pointerdown", handlePlayerTouch);
      playerContainer.addEventListener("touchstart", handlePlayerTouch, {
        passive: true,
      });
    }

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("message", handlePostMessage);

    // Fallback cerdas: Jika pengguna sudah berada di halaman menonton selama 6 detik
    // dengan tab aktif, aktifkan perekaman otomatis (untuk video yang autoplay)
    const autoStartTimer = setTimeout(() => {
      if (!document.hidden && !isTrackingRef.current) {
        setIsTracking(true);
        isTrackingRef.current = true;
      }
    }, 6000);

    return () => {
      clearTimeout(autoStartTimer);
      if (playerContainer) {
        playerContainer.removeEventListener("mouseenter", handleMouseEnter);
        playerContainer.removeEventListener("mouseleave", handleMouseLeave);
        playerContainer.removeEventListener("pointerdown", handlePlayerTouch);
        playerContainer.removeEventListener("touchstart", handlePlayerTouch);
      }
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("message", handlePostMessage);
    };
  }, []);

  // 3. Tangani perubahan visibilitas tab (jeda jika tab ditutup / background)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        // Tab di-minimize / buka tab lain: Jeda perhitungan agar tidak ngelantur
        isTrackingRef.current = false;
        setIsTracking(false);
      } else {
        // Kembali ke tab video: Lanjutkan pelacakan
        isTrackingRef.current = true;
        setIsTracking(true);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 4. Timer interval penghitung detik otomatis
  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      if (document.hidden) return;

      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking]);

  // 5. Simpan berkala ke Cookie setiap 4 detik saat sedang menonton
  useEffect(() => {
    if (!isTracking) return;

    const autoSaveInterval = setInterval(() => {
      if (secondsRef.current > 0) {
        saveWatchProgress({
          slug,
          title,
          episode: Number(episode),
          seconds: secondsRef.current,
          poster,
          isDonghua,
        });
      }
    }, 4000);

    return () => clearInterval(autoSaveInterval);
  }, [isTracking, slug, title, episode, poster, isDonghua]);

  // 6. Simpan instan saat berpindah rute atau menutup jendela browser
  useEffect(() => {
    const flushSave = () => {
      if (secondsRef.current > 0) {
        saveWatchProgress({
          slug,
          title,
          episode: Number(episode),
          seconds: secondsRef.current,
          poster,
          isDonghua,
        });
      }
    };

    window.addEventListener("beforeunload", flushSave);
    window.addEventListener("pagehide", flushSave);

    return () => {
      flushSave();
      window.removeEventListener("beforeunload", flushSave);
      window.removeEventListener("pagehide", flushSave);
    };
  }, [slug, title, episode, poster, isDonghua]);

  // Terapkan penyesuaian waktu kustom (opsional)
  const handleApplyCustomTime = (e) => {
    e?.preventDefault();
    const parsed = parseTimeToSeconds(customTimeInput);
    secondsRef.current = parsed;
    setSeconds(parsed);
    saveWatchProgress({
      slug,
      title,
      episode: Number(episode),
      seconds: parsed,
      poster,
      isDonghua,
    });
    setShowAdjuster(false);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-card/60 p-2.5 sm:px-4 sm:py-2 backdrop-blur-md transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Sisi Kiri: Status Progres Otomatis */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Indicator Lampu Hijau Berkedip */}
          <span className="relative flex h-2 w-2 shrink-0">
            {isTracking ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
            )}
          </span>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">Riwayat Otomatis:</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-bold text-primary">
              Episode {episode}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="flex items-center gap-1 font-mono font-bold text-foreground">
              <Clock className="h-3 w-3 text-primary" />
              Menit {formatSeconds(seconds)}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: Status Cookie Aktif & Koreksi Menit Minimalis */}
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <Check className="h-3 w-3" />
            {savedBadge ? "Tersimpan!" : "Tersimpan di Cookie"}
          </span>

          {/* Tombol Koreksi Minimalis (Hanya jika pengguna ingin lompat/ubah menit manual) */}
          <button
            type="button"
            onClick={() => setShowAdjuster((prev) => !prev)}
            title="Koreksi menit jika ingin menyamakan dengan pemutar"
            className="inline-flex h-6 items-center gap-1 rounded border border-border/80 bg-background/50 px-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">Koreksi</span>
          </button>
        </div>
      </div>

      {/* Form Koreksi Menit Mini (Hanya terbuka jika tombol Koreksi diklik) */}
      {showAdjuster && (
        <form
          onSubmit={handleApplyCustomTime}
          className="mt-2 flex items-center justify-end gap-1.5 border-t border-border/40 pt-2 animate-in fade-in duration-150"
        >
          <span className="text-[11px] text-muted-foreground">Set menit:</span>
          <input
            type="text"
            value={customTimeInput}
            onChange={(e) => setCustomTimeInput(e.target.value)}
            placeholder="MM:SS (cth: 12:30)"
            className="h-6 w-20 rounded border border-border bg-background px-1.5 text-center font-mono text-[11px] font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="h-6 rounded bg-primary px-2 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Simpan
          </button>
          <button
            type="button"
            onClick={() => setShowAdjuster(false)}
            className="h-6 rounded border border-border p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </form>
      )}
    </div>
  );
}
