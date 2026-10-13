import { NextResponse } from "next/server";
import { getMediaCatalog, getAnimeByGenre } from "@/lib/anime";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = (searchParams.get("genre") || "").trim();
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;

    // Handle genre-specific catalog requests
    if (genre) {
      const result = await getAnimeByGenre(genre, page);
      return NextResponse.json(
        {
          success: true,
          genre,
          page: result.page,
          hasMore: result.hasMore,
          items: result.items || result || [],
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    const rawType = (searchParams.get("type") || "all").toLowerCase();
    const type = rawType === "donghua" ? "donghua" : rawType === "anime" ? "anime" : "all";

    const result = await getMediaCatalog({ type, page });

    return NextResponse.json(
      {
        success: true,
        type,
        page: result.page,
        hasMore: result.hasMore,
        items: result.items,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, items: [], hasMore: false, error: err.message },
      { status: 500 }
    );
  }
}
