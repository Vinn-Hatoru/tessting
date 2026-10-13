import {
  getGenres,
  getAnimeByGenre,
  slugToGenre,
  genreToSlug,
} from "@/lib/anime";
import GenreCatalogClient from "@/components/GenreCatalogClient";

export async function generateMetadata({ params }) {
  const { genre } = await params;
  const name = slugToGenre(genre) || genre;
  return {
    title: name
      ? `Katalog Anime & Donghua Genre ${name} Terbaru Sub Indo — Miru Anime`
      : "Genre",
    description: `Daftar serial anime dan donghua genre ${name} subtitle Indonesia dari yang terbaru sampai terlama.`,
  };
}

export const revalidate = 600; // 10 minutes cache

export default async function GenrePage({ params }) {
  const { genre } = await params;
  const genreName = slugToGenre(genre) || genre;
  const genreSlug = genreToSlug(genre);

  const result = await getAnimeByGenre(genreSlug, 1);
  const items = result?.items || result || [];
  const otherGenres = getGenres().filter(
    (g) => g.name.toLowerCase() !== genreName.toLowerCase()
  );

  return (
    <GenreCatalogClient
      genreSlug={genreSlug}
      genreName={genreName}
      initialItems={items}
      initialHasMore={result.hasMore !== undefined ? result.hasMore : items.length > 0}
      otherGenres={otherGenres}
    />
  );
}
