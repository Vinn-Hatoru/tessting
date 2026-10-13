/**
 * Utility untuk mengelola riwayat tontonan (Watch History / Continue Watching)
 * menggunakan Cookie (miru_watch_history) dengan sinkronisasi otomatis.
 *
 * Menyimpan data:
 * - Anime/Donghua slug & title & poster
 * - Terakhir ditonton di episode berapa
 * - Menit / detik ke berapa (progres waktu)
 * - Waktu update terakhir
 */

const COOKIE_NAME = "miru_watch_history";
const COOKIE_MAX_AGE_DAYS = 365;

/**
 * Format detik menjadi format "MM:SS" atau "HH:MM:SS"
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSeconds(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Parse string waktu "MM:SS" atau menit ke detik
 * @param {string|number} input
 * @returns {number} Detik
 */
export function parseTimeToSeconds(input) {
  if (typeof input === "number") return Math.max(0, Math.floor(input));
  if (!input) return 0;

  const str = String(input).trim();
  const parts = str.split(":").map((p) => parseInt(p, 10));

  if (parts.some((p) => isNaN(p))) {
    const rawNum = parseFloat(str);
    return isNaN(rawNum) ? 0 : Math.max(0, Math.floor(rawNum * 60)); // interpret single number as minutes
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0] * 60;
  }
  return 0;
}

/**
 * Membaca raw cookie string dari browser
 */
function getCookieRaw(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Menyimpan cookie ke browser
 */
function setCookieRaw(name, value, days = COOKIE_MAX_AGE_DAYS) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Mengambil dictionary seluruh riwayat tontonan dari Cookie
 * @returns {Record<string, object>}
 */
export function getWatchHistory() {
  if (typeof window === "undefined") return {};

  try {
    const raw = getCookieRaw(COOKIE_NAME);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (err) {
    // Fallback baca dari localStorage jika parsing cookie gagal
  }

  try {
    const local = localStorage.getItem(COOKIE_NAME);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {}

  return {};
}

/**
 * Mengambil daftar riwayat dalam bentuk Array terurut dari yang paling baru ditonton
 * @returns {Array<object>}
 */
export function getWatchHistoryList() {
  const history = getWatchHistory();
  return Object.values(history).sort(
    (a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)
  );
}

/**
 * Mengambil data terakhir nonton untuk 1 anime spesifik
 * @param {string} slug
 * @returns {object|null}
 */
export function getLastWatched(slug) {
  if (!slug) return null;
  const history = getWatchHistory();
  return history[slug] || null;
}

/**
 * Menyimpan progres tontonan ke Cookie (dan sinkronisasi localStorage)
 * @param {object} item
 * @param {string} item.slug
 * @param {string} item.title
 * @param {number} item.episode
 * @param {number} item.seconds
 * @param {string} [item.poster]
 * @param {boolean} [item.isDonghua]
 */
export function saveWatchProgress({
  slug,
  title,
  episode,
  seconds,
  poster,
  isDonghua = false,
}) {
  if (!slug || episode === undefined) return;

  const currentHistory = getWatchHistory();
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const progressText = formatSeconds(safeSeconds);

  currentHistory[slug] = {
    slug,
    title: title || currentHistory[slug]?.title || slug,
    episode: Number(episode) || 1,
    episodeTitle: `Episode ${episode}`,
    seconds: safeSeconds,
    progressText: progressText,
    poster: poster || currentHistory[slug]?.poster || "",
    isDonghua: Boolean(isDonghua),
    url: `/watch/${slug}/${episode}`,
    lastUpdated: Date.now(),
  };

  // Batasi history maksimal 25 anime teratas agar ukuran cookie tetap ringan (< 3KB)
  const entries = Object.entries(currentHistory);
  if (entries.length > 25) {
    entries.sort((a, b) => (b[1].lastUpdated || 0) - (a[1].lastUpdated || 0));
    const trimmed = Object.fromEntries(entries.slice(0, 25));
    const jsonStr = JSON.stringify(trimmed);
    setCookieRaw(COOKIE_NAME, jsonStr);
    try {
      localStorage.setItem(COOKIE_NAME, jsonStr);
    } catch {}
  } else {
    const jsonStr = JSON.stringify(currentHistory);
    setCookieRaw(COOKIE_NAME, jsonStr);
    try {
      localStorage.setItem(COOKIE_NAME, jsonStr);
    } catch {}
  }

  // Kirimkan CustomEvent agar komponen lain (seperti Navbar / ContinueWatching) langsung update secara reaktif
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("miru:watch_progress_updated", {
        detail: currentHistory[slug],
      })
    );
  }
}

/**
 * Menghapus 1 anime dari riwayat tontonan
 * @param {string} slug
 */
export function removeWatchEntry(slug) {
  if (!slug) return;
  const history = getWatchHistory();
  if (history[slug]) {
    delete history[slug];
    const jsonStr = JSON.stringify(history);
    setCookieRaw(COOKIE_NAME, jsonStr);
    try {
      localStorage.setItem(COOKIE_NAME, jsonStr);
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("miru:watch_progress_updated", { detail: { slug, removed: true } })
      );
    }
  }
}

/**
 * Menghapus seluruh riwayat tontonan
 */
export function clearWatchHistory() {
  setCookieRaw(COOKIE_NAME, "{}", 0);
  try {
    localStorage.removeItem(COOKIE_NAME);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("miru:watch_progress_updated", { detail: { cleared: true } })
    );
  }
}
