import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Container from "@/components/Container";
import SectionHeader from "@/components/SectionHeader";
import VideoPlayer from "@/components/VideoPlayer";
import WatchProgressTracker from "@/components/WatchProgressTracker";
import EpisodeList from "@/components/EpisodeList";
import AnimeGrid from "@/components/AnimeGrid";
import {
  getAnimeBySlug,
  getEpisodesForAnime,
  getAvailableEpisodeCount,
  getRelatedAnime,
  getEpisodeData,
  getItemLink,
  isDonghua,
} from "@/lib/anime";

export async function generateMetadata({ params }) {
  const { slug, episode } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) return { title: "Episode not found" };
  const isMovie = anime.type === "Movie";
  return {
    title: isMovie ? `${anime.title} — Full Movie` : `${anime.title} — Episode ${episode}`,
    referrer: "no-referrer",
  };
}

export default async function WatchPage({ params }) {
  const { slug, episode } = await params;
  const anime = await getAnimeBySlug(slug);
  const episodeNumber = Number(episode);

  if (!anime || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    notFound();
  }

  const isMovie = anime.type === "Movie";
  const isDonghuaMedia = isDonghua(anime);
  const mediaLink = anime.urlPath || getItemLink(anime);

  const episodeData = await getEpisodeData(slug, episodeNumber);
  const episodes = getEpisodesForAnime(anime);
  const total = Math.max(getAvailableEpisodeCount(anime), episodes.length);

  const related = await getRelatedAnime(anime, 6);
  const prevEpisode = !isMovie && episodeNumber > 1 ? episodeNumber - 1 : null;
  const nextEpisode = !isMovie ? (total ? (episodeNumber < total ? episodeNumber + 1 : null) : episodeNumber + 1) : null;

  const prevButtonClass = `inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
    prevEpisode
      ? "border-border bg-card text-foreground hover:bg-muted"
      : "pointer-events-none border-border text-muted-foreground/40"
  }`;
  const nextButtonClass = `inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
    nextEpisode
      ? "border-border bg-card text-foreground hover:bg-muted"
      : "pointer-events-none border-border text-muted-foreground/40"
  }`;

  return (
    <Container className="pb-14 pt-6 sm:pb-16 sm:pt-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="transition-colors duration-150 hover:text-primary"
        >
          Home
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <Link
          href={isDonghuaMedia ? "/genre/donghua" : "/#latest"}
          className="transition-colors duration-150 hover:text-primary"
        >
          {isDonghuaMedia ? "Donghua" : "Anime"}
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <Link
          href={mediaLink}
          className="max-w-[180px] truncate transition-colors duration-150 hover:text-primary sm:max-w-none"
        >
          {anime.title}
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className="text-foreground/80">
          {isMovie ? "Full Movie" : `Episode ${episodeNumber}`}
        </span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        {/* Player column */}
        <div className="min-w-0">
          <VideoPlayer
            embedUrl={episodeData?.activeEmbedUrl}
            streams={episodeData?.streams}
            downloads={episodeData?.downloads}
            poster={episodeData?.thumbnail || anime.banner || anime.poster}
            title={isMovie ? `${anime.title} — Full Movie` : `${anime.title} — Episode ${episodeNumber}`}
          >
            {/* Live Progress & Cookie Tracker */}
            <WatchProgressTracker
              slug={anime.slug}
              title={anime.title}
              episode={episodeNumber}
              poster={anime.poster || anime.banner || episodeData?.thumbnail}
              isDonghua={isDonghuaMedia}
            />
          </VideoPlayer>

          {/* Episode heading + prev / next */}
          <div className="mt-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {isMovie ? "Full Movie" : `Episode ${episodeNumber}`}
              </p>
              <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                <Link
                  href={mediaLink}
                  className="transition-colors duration-150 hover:text-primary"
                >
                  {anime.title}
                </Link>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {anime.year} · {anime.studio}
              </p>
            </div>

            {!isMovie ? (
              <div className="flex shrink-0 items-center gap-2 pt-1">
                {prevEpisode ? (
                  <Link
                    href={`/watch/${anime.slug}/${prevEpisode}`}
                    className={prevButtonClass}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Prev</span>
                  </Link>
                ) : (
                  <span className={prevButtonClass} aria-disabled="true">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Prev</span>
                  </span>
                )}
                {nextEpisode ? (
                  <Link
                    href={`/watch/${anime.slug}/${nextEpisode}`}
                    className={nextButtonClass}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className={nextButtonClass} aria-disabled="true">
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <Link
                  href={mediaLink}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Detail Film
                </Link>
              </div>
            )}
          </div>

          {/* Short description */}
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {isMovie ? "Sinopsis Film" : "Tentang episode ini"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {anime.synopsis}
            </p>
            <p className="mt-3 text-xs text-muted-foreground/80">
              Streaming server embed terhubung langsung dengan penyedia tayangan. Jika video buffering atau link terputus, ganti server melalui tombol pilihan server di atas.
            </p>
          </div>

          {/* Mobile episode list / movie card */}
          <div className="mt-8 lg:hidden">
            {!isMovie ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Episodes</h2>
                  <span className="text-sm text-muted-foreground">
                    {total} episodes
                  </span>
                </div>
                <EpisodeList
                  anime={anime}
                  episodes={episodes}
                  activeEpisode={episodeNumber}
                  scrollable
                  maxHeight="320px"
                />
              </>
            ) : (
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">Informasi Film</h2>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Tipe: <span className="text-foreground">Movie</span></p>
                  <p>Studio: <span className="text-foreground">{anime.studio}</span></p>
                  <p>Rilis: <span className="text-foreground">{anime.year}</span></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop episode sidebar / movie card */}
        <aside className="hidden lg:block">
          {!isMovie ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight text-foreground">Episodes</h2>
                <span className="text-sm text-muted-foreground">
                  {total} episodes
                </span>
              </div>
              <EpisodeList
                anime={anime}
                episodes={episodes}
                activeEpisode={episodeNumber}
                scrollable
                maxHeight="560px"
              />
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Informasi Film</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span>Tipe</span>
                  <span className="font-medium text-foreground">Movie</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span>Studio</span>
                  <span className="font-medium text-foreground">{anime.studio}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span>Tahun</span>
                  <span className="font-medium text-foreground">{anime.year}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span>Status</span>
                  <span className="font-medium text-foreground">{anime.status}</span>
                </div>
              </div>
              <div className="mt-4 pt-2">
                <Link
                  href={mediaLink}
                  className="inline-flex w-full items-center justify-center rounded-md border border-border bg-muted/60 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {isDonghuaMedia ? "Buka Halaman Donghua Lengkap" : "Buka Halaman Anime Lengkap"}
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Related anime */}
      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-14 sm:mt-16">
          <SectionHeader
            title="Related Anime"
            subtitle="You might also like these"
          />
          <AnimeGrid animes={related} />
        </section>
      ) : null}
    </Container>
  );
}
