import { getMediaCatalog } from "@/lib/anime";
import MediaCatalogClient from "@/components/MediaCatalogClient";

export const metadata = {
  title: "Katalog Anime Terbaru Sub Indo — Miru Anime",
  description:
    "Daftar anime terlengkap dari episode dan rilis terbaru hingga terlama dengan subtitle Indonesia resolusi tinggi.",
};

export const revalidate = 600; // 10 minutes cache

export default async function AnimeListPage() {
  const result = await getMediaCatalog({ type: "anime", page: 1 });

  return (
    <MediaCatalogClient
      type="anime"
      initialItems={result.items || []}
      title="Katalog Anime"
      subtitle="Koleksi serial dan film anime subtitle Indonesia, terurut otomatis dari update terbaru hingga terlama."
      badge="Serial Anime"
    />
  );
}
