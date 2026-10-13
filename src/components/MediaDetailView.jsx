import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, Film, Play, Star, ExternalLink } from "lucide-react";
import Container from "@/components/Container";
import SectionHeader from "@/components/SectionHeader";
import StatusBadge from "@/components/StatusBadge";
import GenreBadge from "@/components/GenreBadge";
import EpisodeList from "@/components/EpisodeList";
import ResumeWatchBanner from "@/components/ResumeWatchBanner";
import EmptyState from "@/components/EmptyState";
import AnimeGrid from "@/components/AnimeGrid";
import {
  formatRating,
  getTrailerEmbedUrl,
  getTrailerWatchUrl,
  getItemLink,
  isDonghua as checkIsDonghua,
} from "@/lib/anime";

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

export default function MediaDetailView({
  anime,
  episodes = [],
  available = 0,
  related = [],
  isDonghuaPage = false,
}) {
  if (!anime) return null;

  const isMovie = anime.type === "Movie";
  const isDonghua = isDonghuaPage || checkIsDonghua(anime);
  const mediaTypeLabel = isDonghua ? "Donghua" : isMovie ? "Film" : "Anime";
  const trailerEmbedUrl = getTrailerEmbedUrl(
    anime.trailer || anime.raw?.trailer || anime.details?.trailer
  );
  const trailerWatchUrl = getTrailerWatchUrl(
    anime.trailer || anime.raw?.trailer || anime.details?.trailer
  );

  const displayEpisodes =
    anime.episodes > 0
      ? anime.episodes
      : available > 0
      ? available
      : null;

  return (
    <>
      {/* Banner header */}
      <div className="relative">
        <div className="relative h-40 overflow-hidden bg-neutral-900 sm:h-60 lg:h-72">
          {anime.banner ? (
            <Image
              src={anime.banner}
              alt={`${anime.title} banner`}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <Image
              src={anime.poster}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-110 object-cover object-top opacity-50 blur-md"
            />
          )}
          {/* Fade the banner into the page background */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-neutral-950/30" />
        </div>

        <Container className="relative -mt-20 pb-8 sm:-mt-24">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:gap-7">
            <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-border/60 sm:mx-0 sm:w-44 lg:w-48">
              <Image
                src={anime.poster}
                alt={`${anime.title} poster`}
                fill
                priority
                sizes="192px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              {/* Dynamic Breadcrumb */}
              <nav
                aria-label="Breadcrumb"
                className="mb-2 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
              >
                <Link
                  href="/"
                  className="transition-colors duration-150 hover:text-primary"
                >
                  Home
                </Link>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <Link
                  href={isDonghua ? "/genre/donghua" : "/#latest"}
                  className="transition-colors duration-150 hover:text-primary"
                >
                  {isDonghua ? "Donghua" : "Anime"}
                </Link>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <span className="text-foreground/80">{anime.title}</span>
              </nav>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {isDonghua ? (
                  <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500 border border-amber-500/30">
                    Donghua 🇨🇳
                  </span>
                ) : null}
              </div>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {anime.title}
              </h1>
              {anime.alternativeTitle ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {anime.alternativeTitle}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <Star
                    className="h-4 w-4 fill-primary text-primary"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-foreground">
                    {formatRating(anime.rating)}
                  </span>
                </span>
                <StatusBadge status={anime.status} variant="pill" />
                <span>{anime.year}</span>
                <span aria-hidden="true" className="text-border">
                  ·
                </span>
                <span>{anime.type}</span>
                {!isMovie && displayEpisodes ? (
                  <>
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                    <span>{displayEpisodes} episodes</span>
                  </>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {anime.genres.map((genre) => (
                  <GenreBadge key={genre} genre={genre} />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                {available > 0 ? (
                  <Link
                    href={`/watch/${anime.slug}/${episodes[0]?.number || 1}`}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    {isMovie
                      ? "Watch Movie"
                      : isDonghua
                      ? "Tonton Donghua"
                      : "Watch Now"}
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center gap-2 rounded-md bg-primary/50 px-5 text-sm font-medium text-white">
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    {isMovie ? "Watch Movie" : "Watch Now"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {isMovie
                    ? "Full Movie Streaming Tersedia"
                    : displayEpisodes
                    ? `${available} of ${displayEpisodes} episodes available`
                    : available > 0
                    ? `${available} episode tersedia`
                    : "Episodes will be available after release"}
                </span>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Body */}
      <Container className="pb-14 sm:pb-16">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="min-w-0 space-y-10 lg:col-span-2">
            {/* Synopsis */}
            <section aria-labelledby="synopsis-heading">
              <h2
                id="synopsis-heading"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Synopsis
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground whitespace-pre-line">
                {anime.synopsis}
              </p>
            </section>

            {/* YouTube Trailer Section */}
            {trailerEmbedUrl ? (
              <section aria-labelledby="trailer-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2
                      id="trailer-heading"
                      className="text-lg font-semibold tracking-tight text-foreground"
                    >
                      Trailer Resmi {mediaTypeLabel}
                    </h2>
                  </div>
                  {trailerWatchUrl && (
                    <a
                      href={trailerWatchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-xs font-medium text-foreground transition-all duration-150 hover:bg-muted hover:text-primary hover:border-primary/40"
                    >
                      <span>Buka di YouTube</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-neutral-950 shadow-xl ring-1 ring-border/50">
                  <iframe
                    src={trailerEmbedUrl}
                    title={`${anime.title} — Official Trailer`}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="text-[11px] text-muted-foreground/80">
                    ℹ️ Jika video dibatasi atau error di browser Anda, gunakan tombol di atas untuk menonton langsung di YouTube.
                  </span>
                  {trailerWatchUrl && (
                    <a
                      href={trailerWatchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-medium text-xs ml-auto"
                    >
                      Buka di YouTube ↗
                    </a>
                  )}
                </div>
              </section>
            ) : null}

            {/* Episodes / Movie Play Block */}
            <ResumeWatchBanner slug={anime.slug} title={anime.title} />

            {isMovie ? (
              <section aria-labelledby="movie-heading">
                <h2
                  id="movie-heading"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  Tonton Film
                </h2>
                <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {anime.title} — Full Movie
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Subtitle Indonesia · Server HD
                    </p>
                  </div>
                  <Link
                    href={`/watch/${anime.slug}/1`}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    Putar Sekarang
                  </Link>
                </div>
              </section>
            ) : (
              <section aria-labelledby="episodes-heading">
                <div className="flex items-center justify-between gap-4">
                  <h2
                    id="episodes-heading"
                    className="text-lg font-semibold tracking-tight text-foreground"
                  >
                    Episodes
                  </h2>
                  {available > 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {available} {available > 1 ? "episodes" : "episode"}
                    </span>
                  ) : null}
                </div>

                {available > 0 ? (
                  <EpisodeList
                    anime={anime}
                    episodes={episodes}
                    scrollable
                    maxHeight="430px"
                    className="mt-4"
                  />
                ) : (
                  <EmptyState
                    icon={Clock}
                    title="No episodes yet"
                    description={`${anime.title} is currently listed as ${anime.status.toLowerCase()}. Episodes will appear here once they start airing.`}
                  />
                )}
              </section>
            )}
          </div>

          {/* Details sidebar */}
          <aside aria-labelledby="details-heading">
            <h2
              id="details-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Details
            </h2>
            <dl className="mt-4 divide-y divide-border/60 rounded-lg border border-border bg-card">
              <DetailRow label="Status">
                <StatusBadge status={anime.status} variant="pill" />
              </DetailRow>
              <DetailRow label="Type">{anime.type}</DetailRow>
              <DetailRow label="Studio">{anime.studio}</DetailRow>
              {anime.author ? (
                <DetailRow label="Pengarang">{anime.author}</DetailRow>
              ) : null}
              <DetailRow label="Released">{anime.year}</DetailRow>
              <DetailRow label="Episodes">
                {isMovie
                  ? "1 (Full Movie)"
                  : displayEpisodes
                  ? displayEpisodes
                  : "Ongoing"}
              </DetailRow>
              <DetailRow label="Rating">
                <span className="flex items-center gap-1.5">
                  <Star
                    className="h-3.5 w-3.5 fill-primary text-primary"
                    aria-hidden="true"
                  />
                  {formatRating(anime.rating)} / 10
                </span>
              </DetailRow>
            </dl>
          </aside>
        </div>

        {/* Related Section */}
        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-14 sm:mt-16">
            <SectionHeader
              title={isDonghua ? "Related Donghua" : "Related Anime"}
              subtitle={
                isDonghua
                  ? "Serial animasi 3D & 2D Tiongkok terkait"
                  : "More titles with similar themes"
              }
            />
            <AnimeGrid animes={related} />
          </section>
        ) : null}
      </Container>
    </>
  );
}
