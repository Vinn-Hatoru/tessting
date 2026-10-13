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
  if (!anime) return { title: "Anime not found" };
  return {
    title: anime.title,
    description: anime.synopsis ? anime.synopsis.slice(0, 150) : "",
  };
}

export default async function AnimeDetailPage({ params }) {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) notFound();

  // If this item is a Donghua, dynamically redirect to the canonical /donghua path
  if (isDonghua(anime)) {
    redirect(`/donghua/${slug}`);
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
      isDonghuaPage={false}
    />
  );
}
