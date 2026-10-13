import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatRating, getItemLink, isDonghua } from "@/lib/anime";

/**
 * Standard anime poster card — poster, title, rating/episodes, status.
 * `episodeBadge` renders an "EP n" tag on the poster (used by
 * the Latest Episodes section).
 */
export default function AnimeCard({ anime, episodeBadge = false }) {
  if (!anime) return null;

  const linkHref = anime.urlPath || getItemLink(anime);
  const isDonghuaItem = isDonghua(anime);

  return (
    <article>
      <Link href={linkHref} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-1 ring-border/60 transition-shadow duration-200 group-hover:shadow-md dark:group-hover:shadow-primary/5">
          <Image
            src={anime.poster}
            alt={`${anime.title} poster`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
            className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          />
          {episodeBadge && anime.latestEpisode > 0 ? (
            <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
              EP {anime.latestEpisode}
            </span>
          ) : null}
          {isDonghuaItem ? (
            <span className="absolute right-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-neutral-950 backdrop-blur-sm">
              Donghua
            </span>
          ) : null}
          {anime.status === "Upcoming" ? (
            <span className="absolute left-2 top-2 rounded bg-neutral-950/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              Upcoming
            </span>
          ) : null}
        </div>
        <div className="mt-2.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
            {anime.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star
              className="h-3 w-3 shrink-0 fill-primary text-primary"
              aria-hidden="true"
            />
            <span className="font-medium text-foreground/90">
              {formatRating(anime.rating)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {anime.type === "Movie"
                ? "Movie"
                : anime.episodes > 0
                ? `${anime.episodes} eps`
                : anime.status === "Ongoing"
                ? "Ongoing"
                : "Series"}
            </span>
          </div>
          <div className="mt-1.5">
            <StatusBadge status={anime.status} />
          </div>
        </div>
      </Link>
    </article>
  );
}
