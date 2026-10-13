import * as cheerio from "cheerio";
import { AnimasuScraper } from "./animasuScraper.js";
import { AnimeScraper } from "./animeScraper.js";

/**
 * Data-access helpers for the anime catalog.
 * Primary data source: AnimasuScraper (100% dynamic, complete data).
 * Fallback: AnimeScraper (used when animasu is down, returns empty, or encounters an issue).
 * In-memory caching for speed and stability.
 */

// Primary AnimasuScraper instance with reasonable timeout for snappy response and fallback
const animasu = new AnimasuScraper({
  timeout: 8000,
  fallbackDomains: ["https://animasu.love", "https://animasu.cc"],
});

// In-memory cache configurations
const homeCache = { timestamp: 0, data: null };
const CACHE_TTL_HOME = 10 * 60 * 1000; // 10 minutes

const seriesCache = new Map();
const CACHE_TTL_SERIES = 30 * 60 * 1000; // 30 minutes

const episodeCache = new Map();
const CACHE_TTL_EPISODE = 30 * 60 * 1000; // 30 minutes

const genreCache = new Map();
const CACHE_TTL_GENRE = 30 * 60 * 1000; // 30 minutes

const catalogCache = new Map();
const CACHE_TTL_CATALOG = 15 * 60 * 1000; // 15 minutes

export const POPULAR_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Isekai",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "School",
  "Harem",
  "Shounen",
  "Donghua",
];

const INDO_TO_EN_GENRES = {
  aksi: "Action",
  petualangan: "Adventure",
  komedi: "Comedy",
  drama: "Drama",
  fantasi: "Fantasy",
  isekai: "Isekai",
  misteri: "Mystery",
  romantis: "Romance",
  "fiksi ilmiah": "Sci-Fi",
  "fiksi-ilmiah": "Sci-Fi",
  "irisan kehidupan": "Slice of Life",
  "irisan-kehidupan": "Slice of Life",
  olahraga: "Sports",
  supranatural: "Supernatural",
  sekolah: "School",
  harem: "Harem",
  shounen: "Shounen",
  donghua: "Donghua",
};

export function extractSlug(url = "") {
  if (!url) return "";
  const seriesMatch = /\/anime\/([^\/]+)/.exec(url);
  if (seriesMatch && seriesMatch[1]) return seriesMatch[1];
  const nontonMatch = /\/nonton-([^\/]+)-episode-\d+/.exec(url);
  if (nontonMatch && nontonMatch[1]) return nontonMatch[1];
  const epMatch = /\/([^\/]+)-episode-\d+/.exec(url);
  if (epMatch && epMatch[1]) return epMatch[1];
  const parts = url.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "";
}

export function normalizeGenres(rawGenres) {
  if (!Array.isArray(rawGenres) || rawGenres.length === 0) return ["Animation"];
  return rawGenres
    .map((g) => {
      const name = typeof g === "object" && g !== null ? g.name : String(g);
      const clean = name.trim();
      const lower = clean.toLowerCase();
      return INDO_TO_EN_GENRES[lower] || clean;
    })
    .filter(Boolean);
}

export function parseStatus(rawStatus, isMovie = false, isOngoing = false) {
  if (isOngoing) return "Ongoing";
  if (!rawStatus) return isMovie ? "Completed" : "Ongoing";
  const lower = String(rawStatus).toLowerCase();
  if (
    lower.includes("finish") ||
    lower.includes("complete") ||
    lower.includes("tamat") ||
    lower.includes("selesai")
  ) {
    return "Completed";
  }
  if (
    lower.includes("sedang tayang") ||
    lower.includes("airing") ||
    lower.includes("ongoing") ||
    lower.includes("berjalan")
  ) {
    return "Ongoing";
  }
  if (
    lower.includes("upcom") ||
    lower === "uc" ||
    lower.includes("akan tayang") ||
    lower.includes("akan")
  ) {
    return "Upcoming";
  }
  return isMovie ? "Completed" : "Ongoing";
}

function cleanPosterUrl(url = "") {
  if (!url) return "";
  if (url.includes("wp.com/")) {
    return url.replace(/^https?:\/\/i\d+\.wp\.com\//i, "https://");
  }
  return url;
}

export function normalizeCatalogItem(raw, idx = 0) {
  if (!raw) return null;
  const ratingNum = parseFloat(raw.score || raw.raw_score) || 8.0;
  const slug = raw.slug || (raw.url ? extractSlug(raw.url) : `anime-${idx}`);
  const isMovie =
    raw.type === "Movie" ||
    (raw.title && raw.title.toLowerCase().includes("movie")) ||
    slug.includes("-movie");

  let epNum = parseInt(
    String(raw.episode_number || raw.episode || "").replace(/\D+/g, ""),
    10
  );
  if (isNaN(epNum) || epNum <= 0) {
    epNum = isMovie ? 1 : null;
  }
  const thumb = cleanPosterUrl(raw.poster_clean || raw.poster || raw.thumbnail || "");
  let status = parseStatus(raw.status, isMovie, raw.is_ongoing || raw.details?.is_ongoing);

  const genres = normalizeGenres(raw.genres);
  const isDonghuaItem =
    raw.isDonghua === true ||
    raw.type?.toLowerCase() === "donghua" ||
    (typeof raw.details?.type === "string" && raw.details.type.toLowerCase() === "donghua") ||
    genres.some((g) => g.toLowerCase() === "donghua") ||
    slug.includes("donghua");
  const urlPath = isDonghuaItem ? `/donghua/${slug}` : `/anime/${slug}`;

  return {
    id: slug,
    slug: slug,
    title: raw.title || "Untitled Anime",
    alternativeTitle: raw.japanese_title || raw.raw_title || "",
    poster: thumb,
    banner: thumb,
    rating: ratingNum,
    popularity: Math.max(10, 100 - idx * 3),
    status: status,
    type: isMovie ? "Movie" : (raw.type || "TV"),
    duration: raw.duration || raw.details?.duration || "",
    episodes: isMovie ? 1 : epNum,
    latestEpisode: isMovie ? 1 : epNum,
    year: raw.release_date || raw.details?.release_date || 2024,
    studio:
      (typeof raw.studio === "object" ? raw.studio?.name : raw.studio) ||
      (typeof raw.details?.studio === "object" ? raw.details?.studio?.name : raw.details?.studio) ||
      "Animation Studio",
    genres: genres,
    isDonghua: isDonghuaItem,
    urlPath: urlPath,
    synopsis:
      raw.synopsis ||
      raw.description ||
      (raw.title
        ? `Nonton dan streaming anime ${raw.title} subtitle Indonesia online terlengkap dengan kualitas jernih.`
        : ""),
    isTrending: idx < 6,
    trendingRank: idx + 1,
    url: raw.url || "",
    raw,
  };
}

export function normalizeSeriesData(raw, fallbackSlug = "") {
  if (!raw) return null;
  const slug = raw.slug || (raw.url ? extractSlug(raw.url) : fallbackSlug);
  const ratingNum = parseFloat(raw.score || raw.raw_score) || 8.2;
  const thumb = cleanPosterUrl(raw.poster_clean || raw.poster || raw.thumbnail || "");
  const isMovie =
    raw.type === "Movie" ||
    (raw.title && raw.title.toLowerCase().includes("movie")) ||
    slug.includes("-movie");

  const rawEpisodes = Array.isArray(raw.episodes) ? raw.episodes : [];
  const episodesList = rawEpisodes.map((ep, i) => {
    const num = parseInt(String(ep.number ?? ep.episode_number ?? i + 1), 10) || i + 1;
    return {
      number: num,
      title: ep.title
        ? ep.title.replace(/\n/g, " ").trim()
        : (isMovie ? "Full Movie" : `Episode ${num}`),
      url: ep.url || "",
      duration: ep.duration || raw.details?.duration || raw.duration || "",
      releaseDate: ep.release_date || ep.date || "",
    };
  });

  // Sort ascending by episode number so Episode 1 is consistently first
  episodesList.sort((a, b) => a.number - b.number);

  const parsedTotal = parseInt(
    String(raw.total_episodes || raw.details?.total_episodes_text || "").replace(/\D+/g, ""),
    10
  );

  const totalEp = isMovie
    ? 1
    : episodesList.length > 0
    ? Math.max(episodesList.length, parsedTotal || 0)
    : (parsedTotal || null);

  const latestEp = isMovie
    ? 1
    : episodesList.length > 0
    ? Math.max(...episodesList.map((e) => e.number))
    : totalEp;

  const studioName =
    (typeof raw.details?.studio === "object"
      ? raw.details?.studio?.name
      : raw.details?.studio) ||
    raw.studio ||
    "Animation Studio";

  const authorName =
    (typeof raw.details?.author === "object"
      ? raw.details?.author?.name
      : raw.details?.author) ||
    raw.author ||
    "";

  const genres = normalizeGenres(raw.genres);
  const isDonghuaItem =
    raw.type?.toLowerCase() === "donghua" ||
    (typeof raw.details?.type === "string" && raw.details.type.toLowerCase() === "donghua") ||
    genres.some((g) => g.toLowerCase() === "donghua");
  const urlPath = isDonghuaItem ? `/donghua/${slug}` : `/anime/${slug}`;

  return {
    id: slug,
    slug: slug,
    title: raw.title || "Untitled Anime",
    alternativeTitle: raw.japanese_title || raw.raw_title || "",
    poster: thumb,
    banner: thumb,
    rating: ratingNum,
    popularity: 96,
    status: parseStatus(raw.details?.status || raw.status, isMovie, raw.details?.is_ongoing),
    type: isMovie ? "Movie" : (raw.type || raw.details?.type || "TV"),
    duration: raw.details?.duration || raw.duration || "",
    episodes: totalEp,
    latestEpisode: latestEp,
    year: raw.details?.release_date || raw.release_date || 2024,
    studio: studioName,
    author: authorName,
    genres: genres,
    isDonghua: isDonghuaItem,
    urlPath: urlPath,
    synopsis:
      raw.synopsis ||
      raw.description ||
      `Nonton dan streaming ${raw.title} subtitle Indonesia episode terbaru full HD di Miru Anime.`,
    isTrending: true,
    trendingRank: 1,
    episodesList: episodesList,
    trailer: raw.trailer || null,
    batchDownloads: raw.batch_downloads || [],
    raw,
  };
}

export function isDonghua(anime) {
  if (!anime) return false;
  if (anime.isDonghua === true) return true;
  const typeStr = (anime.type || anime.raw?.type || anime.details?.type || "").toLowerCase();
  if (typeStr === "donghua" || typeStr.includes("donghua")) return true;
  if (Array.isArray(anime.genres)) {
    const hasDg = anime.genres.some((g) => {
      const str = typeof g === "string" ? g : g?.name || "";
      return str.toLowerCase() === "donghua";
    });
    if (hasDg) return true;
  }
  const slug = (anime.slug || anime.id || "").toLowerCase();
  if (slug.includes("donghua")) return true;
  const title = (anime.title || "").toLowerCase();
  if (
    /\[(?:lian qi|cang yuan|tang sect|the grand lord|wan jie|xian ni|wu dong|doupo|shrouding|tomb of fallen|perfect world|swallowed star|renegade|lingwu|battle through|soul land|immortal|demon hunter|peerless|jade dynasty)\]/i.test(title) ||
    /soul land|perfect world|swallowed star|battle through the heavens|renegade immortal|jade dynasty|shrouding the heavens|tales of demons|stellar transformation|a will eternal|record of a mortal|martial universe|yi nian yong heng|cang yuan tu/i.test(title)
  ) {
    return true;
  }
  return false;
}

export function getItemLink(anime) {
  if (!anime || !anime.slug) return "#";
  return isDonghua(anime) ? `/donghua/${anime.slug}` : `/anime/${anime.slug}`;
}

export function getTrailerEmbedUrl(trailer) {
  if (!trailer) return null;
  let videoId = null;

  if (typeof trailer === "string") {
    const m = trailer.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
    videoId = m ? m[1] : null;
  } else if (trailer.video_id) {
    videoId = trailer.video_id;
  } else if (trailer.watch_url) {
    const m = trailer.watch_url.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
    videoId = m ? m[1] : null;
  } else if (trailer.embed_url) {
    const m = trailer.embed_url.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
    videoId = m ? m[1] : null;
  }

  if (videoId) {
    // youtube-nocookie with rel=0 avoids cross-origin cookie blocks & configuration Error 153
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&enablejsapi=1`;
  }
  return null;
}

export function getTrailerWatchUrl(trailer) {
  if (!trailer) return null;
  if (typeof trailer === "string") {
    const m = trailer.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
    return m ? `https://www.youtube.com/watch?v=${m[1]}` : trailer;
  }
  if (trailer.watch_url) return trailer.watch_url;
  if (trailer.video_id) return `https://www.youtube.com/watch?v=${trailer.video_id}`;
  if (trailer.embed_url) {
    const m = trailer.embed_url.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\?v=)([\w-]{11})/i);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  }
  return null;
}

/**
 * Unified detail extractor: Uses animasu as primary, falls back to AnimeScraper.
 */
async function fetchDetailUnified(slug) {
  if (!slug) return null;

  // 1. Try animasu (Primary)
  try {
    const res = await animasu.extract(slug);
    if (res && res.success && res.data && res.data.title) {
      return res.data;
    }
  } catch (err) {
    console.warn(`[AnimasuScraper] extract(${slug}) failed:`, err.message);
  }

  // 2. Fallback to AnimeScraper
  try {
    const res = await AnimeScraper.getAnimeDetail(slug);
    if (res && res.success && res.data && res.data.title) {
      return res.data;
    }
  } catch (err) {
    console.warn(`[AnimeScraper] getAnimeDetail(${slug}) fallback failed:`, err.message);
  }

  return null;
}

/* ----------------------------- Home & Catalog ----------------------------- */

export async function fetchLiveHomeData() {
  const now = Date.now();
  if (homeCache.data && now - homeCache.timestamp < CACHE_TTL_HOME) {
    return homeCache.data;
  }

  let rawList = [];

  // 1. Primary: animasu getLatest(1)
  try {
    const res = await animasu.getLatest(1);
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      rawList = res.data;
    }
  } catch (err) {
    console.warn("[AnimasuScraper] getLatest(1) failed:", err.message);
  }

  // 2. Fallback: AnimeScraper getHome()
  if (!rawList || rawList.length === 0) {
    try {
      const res = await AnimeScraper.getHome();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        rawList = res.data;
      }
    } catch (err) {
      console.warn("[AnimeScraper] getHome fallback failed:", err.message);
    }
  }

  if (rawList.length > 0) {
    // Dynamic parallel enrichment: ensures true status, real ratings, and accurate metadata
    const enriched = await Promise.all(
      rawList.map(async (item, idx) => {
        let enrichedItem = { ...item };
        const slug = item.slug || (item.url ? extractSlug(item.url) : "");
        if (
          slug &&
          (!enrichedItem.score ||
            !enrichedItem.status ||
            enrichedItem.status === "UC" ||
            !enrichedItem.genres?.length)
        ) {
          try {
            let detailData = null;
            if (seriesCache.has(slug)) {
              detailData = seriesCache.get(slug).data;
            } else {
              detailData = await fetchDetailUnified(slug);
              if (detailData) {
                seriesCache.set(slug, {
                  timestamp: now,
                  data: normalizeSeriesData(detailData, slug),
                });
              }
            }
            if (detailData) {
              enrichedItem = {
                ...enrichedItem,
                status: detailData.details?.status || detailData.status || enrichedItem.status,
                score: detailData.score || detailData.raw_score || enrichedItem.score,
                episode_number:
                  detailData.total_episodes ||
                  (detailData.episodes?.length
                    ? String(detailData.episodes.length)
                    : enrichedItem.episode_number || enrichedItem.episode),
                type: detailData.type || detailData.details?.type || enrichedItem.type,
                genres: detailData.genres || enrichedItem.genres,
                studio:
                  (typeof detailData.details?.studio === "object"
                    ? detailData.details?.studio?.name
                    : detailData.details?.studio) ||
                  detailData.studio ||
                  enrichedItem.studio,
                release_date:
                  detailData.details?.release_date ||
                  detailData.release_date ||
                  enrichedItem.release_date,
                synopsis:
                  detailData.synopsis ||
                  detailData.description ||
                  enrichedItem.synopsis,
                poster_clean: detailData.poster_clean,
                poster: detailData.poster || enrichedItem.poster,
              };
            }
          } catch {
            // fallback gracefully
          }
        }
        return normalizeCatalogItem(enrichedItem, idx);
      })
    );

    homeCache.data = enriched;
    homeCache.timestamp = now;
    return enriched;
  }

  return homeCache.data || [];
}

export async function getFeaturedAnime() {
  const live = await fetchLiveHomeData();
  return Array.isArray(live) ? live.slice(0, 5) : [];
}

export async function getTrendingAnime(limit = 6) {
  const live = await fetchLiveHomeData();
  return Array.isArray(live) ? live.slice(0, limit) : [];
}

export async function getLatestUpdatedAnime(limit = 6) {
  const live = await fetchLiveHomeData();
  return Array.isArray(live) ? live.slice(0, limit) : [];
}

export async function getPopularAnime(limit = 10) {
  const live = await fetchLiveHomeData();
  if (Array.isArray(live) && live.length > 0) {
    return [...live]
      .sort((a, b) => b.rating - a.rating || b.popularity - a.popularity)
      .slice(0, limit);
  }
  return [];
}

/* --------------------------------- Details -------------------------------- */

export async function getAnimeBySlug(slug) {
  if (!slug) return null;

  const now = Date.now();
  if (seriesCache.has(slug)) {
    const entry = seriesCache.get(slug);
    if (now - entry.timestamp < CACHE_TTL_SERIES) {
      return entry.data;
    }
  }

  // 1. Primary: animasu
  try {
    const res = await animasu.extract(slug);
    if (res && res.success && res.data && res.data.title) {
      const normalized = normalizeSeriesData(res.data, slug);
      seriesCache.set(slug, { timestamp: now, data: normalized });
      return normalized;
    }
  } catch (err) {
    console.warn(`[AnimasuScraper] extract(${slug}) failed:`, err.message);
  }

  // 2. Fallback: AnimeScraper
  try {
    const res = await AnimeScraper.getAnimeDetail(slug);
    if (res && res.success && res.data && res.data.title) {
      const normalized = normalizeSeriesData(res.data, slug);
      seriesCache.set(slug, { timestamp: now, data: normalized });
      return normalized;
    }
  } catch (err) {
    console.warn(`[AnimeScraper] getAnimeDetail(${slug}) fallback failed:`, err.message);
  }

  // 3. Check if it exists in the home cache
  if (homeCache.data) {
    const fromHome = homeCache.data.find((a) => a.slug === slug);
    if (fromHome) return fromHome;
  }

  return null;
}

/* -------------------------------- Episodes -------------------------------- */

export async function getEpisodeData(slug, episodeNum = 1) {
  if (!slug) return null;
  const epKey = `${slug}-ep-${episodeNum}`;
  const now = Date.now();

  if (episodeCache.has(epKey)) {
    const entry = episodeCache.get(epKey);
    if (now - entry.timestamp < CACHE_TTL_EPISODE) {
      return entry.data;
    }
  }

  try {
    // 1. Fetch series detail to get real episode URLs
    const series = await getAnimeBySlug(slug);
    let targetUrl = "";
    if (series) {
      if (
        series.type === "Movie" ||
        (Array.isArray(series.episodesList) &&
          series.episodesList.length === 1 &&
          series.episodesList[0]?.title === "Full Movie")
      ) {
        targetUrl = series.episodesList?.[0]?.url || "";
      } else if (
        Array.isArray(series.episodesList) &&
        series.episodesList.length > 0
      ) {
        const matchedEp = series.episodesList.find(
          (e) => String(e.number) === String(episodeNum)
        );
        if (matchedEp && matchedEp.url) {
          targetUrl = matchedEp.url;
        }
      }
    }

    let res = null;

    // 2. Primary: animasu
    if (targetUrl) {
      try {
        res = await animasu.getEpisode(targetUrl);
      } catch (err) {
        console.warn(`[AnimasuScraper] getEpisode(${targetUrl}) failed:`, err.message);
      }
    } else {
      try {
        res = await animasu.getEpisode(slug);
      } catch (err) {
        console.warn(`[AnimasuScraper] getEpisode(${slug}) failed:`, err.message);
      }
    }

    // 3. Fallback: AnimeScraper if Animasu has no stream servers or failed
    if (!res || !res.success || !res.data?.streams?.length) {
      try {
        if (targetUrl && targetUrl.includes("nontonanimeid")) {
          res = await AnimeScraper.extract(targetUrl);
        } else {
          res = await AnimeScraper.getEpisode(slug, episodeNum);
        }
      } catch (err) {
        console.warn(`[AnimeScraper] getEpisode fallback failed:`, err.message);
      }
    }

    if (res && res.success && res.data) {
      const epData = res.data;
      const streams = Array.isArray(epData.streams) ? epData.streams : [];
      const activeStream =
        streams.find((s) => s.embed_url) || streams[0] || null;
      let embedUrl = activeStream?.embed_url || "";
      if (embedUrl && embedUrl.startsWith("//")) {
        embedUrl = "https:" + embedUrl;
      }

      const isMovie =
        series?.type === "Movie" ||
        epData.episode_title?.toLowerCase().includes("movie") ||
        epData.title?.toLowerCase().includes("movie");

      const normalized = {
        success: true,
        seriesId: epData.series_id || slug,
        seriesTitle: epData.series_title || series?.title || "",
        seriesSlug: epData.series_slug || slug,
        seriesUrl: epData.series_url || targetUrl,
        episodeNumber: isMovie
          ? 1
          : parseInt(epData.episode_number, 10) ||
            parseInt(episodeNum, 10) ||
            1,
        episodeTitle: isMovie
          ? "Full Movie"
          : epData.title || epData.episode_title || `Episode ${episodeNum}`,
        episodeUrl: epData.url || epData.episode_url || targetUrl,
        thumbnail:
          cleanPosterUrl(epData.thumbnail) || series?.poster || "",
        prevUrl: epData.prev_episode_url || epData.prev_url || "",
        nextUrl: epData.next_episode_url || epData.next_url || "",
        streams: streams.map((s) => ({
          ...s,
          embed_url: s.embed_url?.startsWith("//")
            ? "https:" + s.embed_url
            : s.embed_url,
        })),
        downloads: Array.isArray(epData.downloads)
          ? epData.downloads
          : Array.isArray(series?.batchDownloads)
          ? series.batchDownloads
          : [],
        activeEmbedUrl: embedUrl,
      };

      episodeCache.set(epKey, { timestamp: now, data: normalized });
      return normalized;
    }
  } catch (err) {
    console.warn(
      `[anime.js] getEpisodeData(${slug}, ${episodeNum}) failed:`,
      err.message
    );
  }

  return null;
}

export function getAvailableEpisodeCount(anime) {
  if (!anime) return 0;
  if (anime.type === "Movie") return 1;
  if (Array.isArray(anime.episodesList) && anime.episodesList.length > 0) {
    return anime.episodesList.length;
  }
  return anime.latestEpisode || anime.episodes || 0;
}

export function getEpisodesForAnime(anime) {
  if (!anime) return [];
  if (Array.isArray(anime.episodesList) && anime.episodesList.length > 0) {
    return anime.episodesList;
  }
  if (anime.type === "Movie") {
    return [
      {
        number: 1,
        title: "Full Movie",
        duration: anime.duration || "Full Length",
      },
    ];
  }
  const count = getAvailableEpisodeCount(anime);
  const list = [];
  for (let n = 1; n <= count; n += 1) {
    list.push({
      number: n,
      title: `Episode ${n}`,
      duration: anime.duration || "",
    });
  }
  return list;
}

/* --------------------------------- Genres --------------------------------- */

export function getGenres() {
  return POPULAR_GENRES.map((name) => ({ name, count: 24 }));
}

export function genreToSlug(genre) {
  return (genre || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToGenre(slug) {
  if (!slug) return null;
  const decoded = decodeURIComponent(slug).toLowerCase();
  if (INDO_TO_EN_GENRES[decoded]) return INDO_TO_EN_GENRES[decoded];
  const found = POPULAR_GENRES.find((g) => genreToSlug(g) === decoded);
  if (found) return found;
  return decoded.charAt(0).toUpperCase() + decoded.slice(1);
}

export function genreLink(genre) {
  return `/genre/${encodeURIComponent(genreToSlug(genre))}`;
}

export async function getAnimeByGenre(genre, page = 1) {
  if (!genre) {
    const empty = [];
    empty.items = [];
    empty.page = 1;
    empty.hasMore = false;
    return empty;
  }

  const cleanGenre = animasu.resolveGenreSlug(genre) || genreToSlug(genre);
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const cacheKey = `genre-${cleanGenre}-${pageNum}`;
  const now = Date.now();

  if (genreCache.has(cacheKey)) {
    const entry = genreCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL_GENRE) {
      return entry.data;
    }
  }

  let rawList = [];
  let hasNext = true;

  // 1. Try Animasu getByGenre (Primary) - ordered newest to oldest
  try {
    const res = await animasu.getByGenre(cleanGenre, pageNum);
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      rawList = res.data.map((item) => ({
        ...item,
        thumbnail: item.thumbnail_clean || item.thumbnail,
      }));
      hasNext = res.has_next_page ?? (res.data.length > 0);
    } else {
      hasNext = false;
    }
  } catch (err) {
    console.warn(`[AnimasuScraper] getByGenre(${genre}, page ${pageNum}) failed:`, err.message);
  }

  // 2. Fallback to AnimeScraper (only on page 1)
  if ((!rawList || rawList.length === 0) && pageNum === 1) {
    try {
      const res = await AnimeScraper.getByGenre(genre);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        rawList = res.data;
        hasNext = rawList.length >= 8;
      }
    } catch (err) {
      console.warn(`[AnimeScraper] getByGenre(${genre}) fallback failed:`, err.message);
    }
  }

  const items = rawList
    .map((item, idx) => normalizeCatalogItem(item, idx))
    .filter(Boolean);

  items.items = items;
  items.page = pageNum;
  items.hasMore = hasNext;

  genreCache.set(cacheKey, { timestamp: now, data: items });
  return items;
}



/**
 * Paginated catalog for Anime and Donghua from newest to oldest.
 * Supports infinite scroll / lazy load pagination.
 *
 * @param {object} options
 * @param {"anime"|"donghua"} [options.type="anime"]
 * @param {number} [options.page=1]
 */
export async function getMediaCatalog({ type = "anime", page = 1 } = {}) {
  const isDonghuaTarget = type === "donghua";
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const cacheKey = `${type}-${pageNum}`;
  const now = Date.now();

  if (catalogCache.has(cacheKey)) {
    const entry = catalogCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL_CATALOG) {
      return entry.data;
    }
  }

  // Combined Anime + Donghua catalog (newest to oldest)
  if (type === "all") {
    const [animeRes, donghuaRes] = await Promise.all([
      getMediaCatalog({ type: "anime", page: pageNum }),
      getMediaCatalog({ type: "donghua", page: pageNum }),
    ]);

    const animeItems = animeRes?.items || [];
    const donghuaItems = donghuaRes?.items || [];
    const combined = [];
    const seenSlugs = new Set();
    const maxLen = Math.max(animeItems.length, donghuaItems.length);

    const donghuaSlugs = new Set(donghuaItems.map((d) => d.slug));
    const normalizedAnime = animeItems.map((item) => {
      if (item && item.slug && donghuaSlugs.has(item.slug)) {
        return {
          ...item,
          isDonghua: true,
          type: "Donghua",
          urlPath: `/donghua/${item.slug}`,
        };
      }
      return item;
    });

    // Interleave and deduplicate so user gets a rich variety of anime & donghua
    for (let i = 0; i < maxLen; i++) {
      if (i < normalizedAnime.length && normalizedAnime[i]?.slug && !seenSlugs.has(normalizedAnime[i].slug)) {
        seenSlugs.add(normalizedAnime[i].slug);
        combined.push(normalizedAnime[i]);
      }
      if (i < donghuaItems.length && donghuaItems[i]?.slug && !seenSlugs.has(donghuaItems[i].slug)) {
        seenSlugs.add(donghuaItems[i].slug);
        combined.push(donghuaItems[i]);
      }
    }

    const result = {
      items: combined,
      page: pageNum,
      hasMore: Boolean(animeRes?.hasMore || donghuaRes?.hasMore),
    };

    catalogCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  }

  let rawList = [];

  if (isDonghuaTarget) {
    try {
      const res = await animasu.getByGenre("donghua", pageNum);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        rawList = res.data.map((item) => ({
          ...item,
          type: "Donghua",
          genres: ["Donghua"],
          isDonghua: true,
          thumbnail: item.thumbnail_clean || item.thumbnail,
        }));
      }
    } catch (err) {
      console.warn(`[AnimasuScraper] getByGenre(donghua, ${pageNum}) failed:`, err.message);
    }

    // Fallback: AnimeScraper getByGenre("donghua")
    if (rawList.length === 0 && pageNum === 1) {
      try {
        const fallbackRes = await AnimeScraper.getByGenre("donghua");
        if (fallbackRes && fallbackRes.success && Array.isArray(fallbackRes.data)) {
          rawList = fallbackRes.data;
        }
      } catch (err) {
        console.warn("[AnimeScraper] getByGenre(donghua) fallback failed:", err.message);
      }
    }
  } else {
    // 1. General Anime from newest to oldest via animasu getLatest(page)
    try {
      const res = await animasu.getLatest(pageNum);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        rawList = res.data;
      }
    } catch (err) {
      console.warn(`[AnimasuScraper] getAnimeCatalog page ${pageNum} failed:`, err.message);
    }

    // Fallback: AnimeScraper getHome() on page 1
    if (rawList.length === 0 && pageNum === 1) {
      try {
        const fallbackRes = await AnimeScraper.getHome();
        if (fallbackRes && fallbackRes.success && Array.isArray(fallbackRes.data)) {
          rawList = fallbackRes.data;
        }
      } catch (err) {
        console.warn("[AnimeScraper] getHome fallback failed:", err.message);
      }
    }
  }

  const items = rawList
    .map((item, idx) => normalizeCatalogItem(item, idx))
    .filter(Boolean);

  const result = {
    items,
    page: pageNum,
    hasMore: rawList.length > 0,
  };

  catalogCache.set(cacheKey, { timestamp: now, data: result });
  return result;
}

/* --------------------------------- Search --------------------------------- */

export function searchLocalAnime(query) {
  const q = (query || "").trim().toLowerCase();
  const baseList = homeCache.data && homeCache.data.length > 0 ? homeCache.data : [];
  if (!q) return baseList;
  return baseList.filter((a) => {
    const haystack = [a.title, a.alternativeTitle, (a.genres || []).join(" ")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function searchAnime(query) {
  const q = (query || "").trim();
  if (!q) return fetchLiveHomeData();

  let rawList = [];

  // 1. Primary: animasu search
  try {
    const res = await animasu.search(q);
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      rawList = res.data;
    }
  } catch (err) {
    console.warn(`[AnimasuScraper] searchAnime(${q}) failed:`, err.message);
  }

  // 2. Fallback: AnimeScraper search
  if (!rawList || rawList.length === 0) {
    try {
      const res = await AnimeScraper.search(q);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        rawList = res.data;
      }
    } catch (err) {
      console.warn(`[AnimeScraper] searchAnime(${q}) fallback failed:`, err.message);
    }
  }

  if (rawList.length > 0) {
    const enriched = await Promise.all(
      rawList.slice(0, 15).map(async (item, idx) => {
        let enrichedItem = { ...item };
        const slug = item.slug || (item.url ? extractSlug(item.url) : "");
        if (slug) {
          try {
            const detail = await fetchDetailUnified(slug);
            if (detail) {
              seriesCache.set(slug, {
                timestamp: Date.now(),
                data: normalizeSeriesData(detail, slug),
              });
              enrichedItem = {
                ...enrichedItem,
                status: detail.details?.status || detail.status || enrichedItem.status,
                score: detail.score || detail.raw_score || enrichedItem.score,
                episode_number:
                  detail.total_episodes ||
                  (detail.episodes?.length
                    ? String(detail.episodes.length)
                    : enrichedItem.episode_number || enrichedItem.episode),
                type: detail.type || detail.details?.type || enrichedItem.type,
                genres: detail.genres || enrichedItem.genres,
                studio:
                  (typeof detail.details?.studio === "object"
                    ? detail.details?.studio?.name
                    : detail.details?.studio) ||
                  detail.studio ||
                  enrichedItem.studio,
                release_date:
                  detail.details?.release_date ||
                  detail.release_date ||
                  enrichedItem.release_date,
                synopsis:
                  detail.synopsis ||
                  detail.description ||
                  enrichedItem.synopsis,
                poster_clean: detail.poster_clean,
                poster: detail.poster || enrichedItem.poster,
              };
            }
          } catch {
            // ignore
          }
        }
        return normalizeCatalogItem(enrichedItem, idx);
      })
    );
    return enriched;
  }

  return searchLocalAnime(q);
}

/* --------------------------------- Sorting -------------------------------- */

export const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Most Popular" },
  { value: "latest", label: "Latest Update" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest Season" },
  { value: "title", label: "Title A–Z" },
];

export function sortAnime(list, sortBy = "popular") {
  if (!Array.isArray(list)) return [];
  const sorted = [...list];
  switch (sortBy) {
    case "trending":
      sorted.sort((a, b) => {
        const rankA = a.trendingRank ?? 999;
        const rankB = b.trendingRank ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return (b.popularity || 0) - (a.popularity || 0);
      });
      break;
    case "latest":
      sorted.sort((a, b) => {
        const epA = a.latestEpisode || 0;
        const epB = b.latestEpisode || 0;
        return epB - epA;
      });
      break;
    case "rating":
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "newest":
      sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
      break;
    case "title":
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
    case "popular":
    default:
      sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      break;
  }
  return sorted;
}

/**
 * Related anime dynamically fetched according to the anime's primary genres.
 */
export async function getRelatedAnime(anime, limit = 6) {
  if (!anime) return [];
  const relatedList = [];
  const seenSlugs = new Set();
  if (anime.slug) seenSlugs.add(anime.slug);

  // 1. Fetch anime matching the primary genres of the current anime
  const genres = Array.isArray(anime.genres) ? anime.genres : [];
  for (const g of genres) {
    if (relatedList.length >= limit) break;
    try {
      const byGenre = await getAnimeByGenre(g);
      if (Array.isArray(byGenre)) {
        for (const item of byGenre) {
          if (item && item.slug && !seenSlugs.has(item.slug)) {
            seenSlugs.add(item.slug);
            relatedList.push(item);
            if (relatedList.length >= limit) break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. If still less than limit, supplement from live home catalog
  if (relatedList.length < limit) {
    try {
      const homeItems = await fetchLiveHomeData();
      if (Array.isArray(homeItems)) {
        for (const item of homeItems) {
          if (item && item.slug && !seenSlugs.has(item.slug)) {
            seenSlugs.add(item.slug);
            relatedList.push(item);
            if (relatedList.length >= limit) break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return relatedList.slice(0, limit);
}

/* --------------------------------- Utils ---------------------------------- */

export function formatRating(rating) {
  const num = typeof rating === "number" ? rating : parseFloat(rating);
  return !isNaN(num) && num > 0 ? num.toFixed(1) : "N/A";
}

export function timeAgo(dateString) {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  const now = new Date().getTime();
  const diffDays = Math.floor((now - then) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
