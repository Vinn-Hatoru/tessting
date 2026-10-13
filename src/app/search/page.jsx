import { Suspense } from "react";
import SearchClient from "@/components/SearchClient";
import { getMediaCatalog } from "@/lib/anime";

export const metadata = {
  title: "Pencarian & Katalog Anime & Donghua Terbaru — Miru Anime",
  description:
    "Cari dan jelajahi anime dan donghua terbaru sub Indo dengan navigasi cepat, filter tipe, dan lazy load.",
};

export const revalidate = 300; // 5 mins cache for SSR

function SearchFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
      <p className="mt-4 text-sm text-muted-foreground">Memuat data pencarian…</p>
    </div>
  );
}

export default async function SearchPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const initialQ = (resolvedParams?.q || "").trim();
  const rawType = (resolvedParams?.type || "all").toLowerCase();
  const initialType =
    rawType === "donghua" ? "donghua" : rawType === "anime" ? "anime" : "all";

  // When opening search without a query, prefetch page 1 directly on the server
  // so the user sees all latest anime & donghua IMMEDIATELY without waiting!
  let initialItems = [];
  if (!initialQ) {
    try {
      const catalog = await getMediaCatalog({ type: initialType, page: 1 });
      initialItems = catalog?.items || [];
    } catch {
      initialItems = [];
    }
  }

  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchClient
        initialQuery={initialQ}
        initialType={initialType}
        initialItems={initialItems}
      />
    </Suspense>
  );
}
