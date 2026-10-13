import { NextResponse } from "next/server";
import { AnimasuScraper } from "@/lib/animasuScraper";
import { AnimeScraper } from "@/lib/animeScraper";
import {
  extractSlug,
  normalizeGenres,
  parseStatus,
  getMediaCatalog,
} from "@/lib/anime";

// In-memory cache for search queries with 10-minute TTL
const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

const animasu = new AnimasuScraper({
  timeout: 8000,
  fallbackDomains: ["https://animasu.love", "https://animasu.cc"],
});

function cleanPoster(url = "") {
  if (!url) return "";
  if (url.includes("wp.com/")) {
    return url.replace(/^https?:\/\/i\d+\.wp\.com\//i, "https://");
  }
  return url;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const page = parseInt(searchParams.get("page") || "1", 10) || 1;
  const typeFilter = (searchParams.get("type") || "all").toLowerCase();

  // If query is empty or too short, return the newest-to-oldest catalog
  if (!q || q.length < 2) {
    try {
      const catalogType =
        typeFilter === "donghua"
          ? "donghua"
          : typeFilter === "anime"
          ? "anime"
          : "all";
      const catalog = await getMediaCatalog({ type: catalogType, page });
      return NextResponse.json(
        {
          success: true,
          isCatalog: true,
          type: catalogType,
          page: catalog.page,
          hasMore: catalog.hasMore,
          results: catalog.items || [],
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    } catch (err) {
      return NextResponse.json({ success: true, results: [], hasMore: false });
    }
  }

  // If user searched explicitly for "donghua" or "anime", route directly to the full catalog
  const cleanQ = q.toLowerCase();
  if (cleanQ === "donghua" || cleanQ === "donghua terbaru") {
    try {
      const catalog = await getMediaCatalog({ type: "donghua", page });
      return NextResponse.json(
        {
          success: true,
          isCatalog: true,
          type: "donghua",
          page: catalog.page,
          hasMore: catalog.hasMore,
          results: catalog.items || [],
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    } catch (err) {
      return NextResponse.json({ success: true, results: [], hasMore: false });
    }
  }
  if (cleanQ === "anime" || cleanQ === "anime terbaru") {
    try {
      const catalog = await getMediaCatalog({ type: "anime", page });
      return NextResponse.json(
        {
          success: true,
          isCatalog: true,
          type: "anime",
          page: catalog.page,
          hasMore: catalog.hasMore,
          results: catalog.items || [],
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    } catch (err) {
      return NextResponse.json({ success: true, results: [], hasMore: false });
    }
  }

  const cacheKey = `${q.toLowerCase()}-${typeFilter}-${page}`;
  const cached = searchCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      results: cached.data.results,
      page: cached.data.page,
      hasMore: cached.data.hasMore,
      cached: true,
    });
  }

  try {
    let rawResults = [];

    // 1. Primary: animasu search (fast & non-blocking)
    try {
      const animasuRes = await animasu.search(q, page);
      if (
        animasuRes &&
        animasuRes.success &&
        Array.isArray(animasuRes.data) &&
        animasuRes.data.length > 0
      ) {
        rawResults = animasuRes.data;
      }
    } catch (err) {
      console.warn(`[AnimasuScraper] search API (${q}, page ${page}) failed:`, err.message);
    }

    // 2. Fallback: AnimeScraper search if primary is empty
    if (!rawResults || rawResults.length === 0) {
      try {
        const fallbackRes = await AnimeScraper.search(q);
        if (
          fallbackRes &&
          fallbackRes.success &&
          Array.isArray(fallbackRes.data) &&
          fallbackRes.data.length > 0
        ) {
          rawResults = fallbackRes.data;
        }
      } catch (err) {
        console.warn(`[AnimeScraper] search API fallback (${q}) failed:`, err.message);
      }
    }

    let results = [];

    if (rawResults.length > 0) {
      results = rawResults
        .map((item, idx) => {
          const slug = item.slug || (item.url ? extractSlug(item.url) : "");
          if (!slug || !item.title) return null;

          const rawType = item.type || "";
          const isMovie =
            rawType === "Movie" ||
            item.title.toLowerCase().includes("movie") ||
            slug.includes("-movie");

          const parsedEp = parseInt(
            String(item.episode || item.episode_number || "").replace(/\D+/g, ""),
            10
          );
          const totalEpisodes = isMovie
            ? 1
            : !isNaN(parsedEp) && parsedEp > 0
            ? parsedEp
            : null;

          const rawGenres = Array.isArray(item.genres) ? item.genres : [];
          const normalizedGenresList = normalizeGenres(rawGenres);

          const isDonghuaItem =
            rawType.toLowerCase() === "donghua" ||
            normalizedGenresList.some((g) => g.toLowerCase() === "donghua") ||
            slug.includes("donghua") ||
            item.title.toLowerCase().includes("donghua");

          // Type filtering if user selected "donghua" or "anime"
          if (typeFilter === "donghua" && !isDonghuaItem) return null;
          if (typeFilter === "anime" && isDonghuaItem) return null;

          const urlPath = isDonghuaItem ? `/donghua/${slug}` : `/anime/${slug}`;
          const poster = cleanPoster(
            item.thumbnail_clean || item.thumbnail || item.poster || item.poster_clean || ""
          );

          return {
            id: slug,
            slug,
            title: item.title,
            alternativeTitle: item.japanese_title || item.raw_title || "",
            poster: poster || "/placeholder.svg",
            banner: poster || "/placeholder.svg",
            thumbnail: poster || "/placeholder.svg",
            episode: totalEpisodes,
            episodes: totalEpisodes,
            latestEpisode: totalEpisodes,
            score: item.score || item.raw_score || "8.0",
            rating: parseFloat(item.score || item.raw_score) || 8.0,
            popularity: Math.max(10, 85 - idx * 2),
            status: parseStatus(item.status, isMovie),
            type: isMovie ? "Movie" : isDonghuaItem ? "Donghua" : rawType || "TV",
            genres: normalizedGenresList.length > 0 ? normalizedGenresList : [isDonghuaItem ? "Donghua" : "Animation"],
            studio: item.studio || "",
            year: item.year || item.release_date || 2024,
            url: item.url || "",
            isDonghua: isDonghuaItem,
            urlPath: urlPath,
          };
        })
        .filter(Boolean);
    }

    const payload = {
      results,
      page,
      hasMore: rawResults.length > 0,
    };

    searchCache.set(cacheKey, { timestamp: now, data: payload });

    return NextResponse.json({
      success: true,
      results: payload.results,
      page: payload.page,
      hasMore: payload.hasMore,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, results: [], hasMore: false, error: err.message },
      { status: 500 }
    );
  }
}
