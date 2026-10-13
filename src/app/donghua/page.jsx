import { getMediaCatalog } from "@/lib/anime";
import MediaCatalogClient from "@/components/MediaCatalogClient";

export const metadata = {
  title: "Katalog Donghua Terbaru Sub Indo — Miru Anime",
  description:
    "Daftar serial Donghua (animasi China 3D & 2D) terlengkap dari yang terbaru sampai terlama dengan subtitle Indonesia.",
};

export const revalidate = 600; // 10 minutes cache

export default async function DonghuaListPage() {
  const result = await getMediaCatalog({ type: "donghua", page: 1 });

  return (
    <MediaCatalogClient
      type="donghua"
      initialItems={result.items || []}
      title="Katalog Donghua"
      subtitle="Koleksi serial animasi 3D dan 2D Tiongkok terlengkap, terurut otomatis dari update terbaru hingga terlama."
      badge="Donghua 🇨🇳"
    />
  );
}
