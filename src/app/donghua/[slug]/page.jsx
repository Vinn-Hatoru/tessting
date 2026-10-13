import { notFound, redirect } from "next/navigation";
import MediaDetailView from "@/components/MediaDetailView";
import {
  getAnimeBySlug,
  getEpisodesForAnime,
  getAvailableEpisodeCount,
  getRelatedAnime,
  isDonghua,
} from "@/lib/anime";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) return { title: "Donghua not found" };
  return {
    title: `${anime.title} — Donghua Sub Indo`,
    description: anime.synopsis ? anime.synopsis.slice(0, 150) : "",
  };
}

export default async function DonghuaDetailPage({ params }) {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) notFound();

  // If this item is standard Anime (not Donghua), redirect to canonical /anime path
  if (!isDonghua(anime)) {
    redirect(`/anime/${slug}`);
  }

  const episodes = getEpisodesForAnime(anime);
  const available = getAvailableEpisodeCount(anime);
  const related = await getRelatedAnime(anime, 6);

  return (
    <MediaDetailView
      anime={anime}
      episodes={episodes}
      available={available}
      related={related}
      isDonghuaPage={true}
    />
  );
}
