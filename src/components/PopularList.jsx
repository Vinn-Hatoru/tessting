import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Star } from "lucide-react";
import { formatRating, getItemLink, isDonghua } from "@/lib/anime";

/**
 * Ranked "popular" list — numbered rows with compact poster thumbnails.
 */
export default function PopularList({ animes = [] }) {
  if (!animes || animes.length === 0) return null;

  return (
    <ol className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
      {animes.map((anime, index) => {
        const linkHref = anime.urlPath || getItemLink(anime);
        const isDonghuaItem = isDonghua(anime);

        return (
          <li key={anime.id}>
            <Link
              href={linkHref}
              className="group flex items-center gap-3 rounded-lg p-2 transition-colors duration-200 hover:bg-muted/70"
            >
              <span
                className={`w-7 shrink-0 text-right text-lg font-semibold tabular-nums ${
                  index < 3 ? "text-primary font-bold" : "text-muted-foreground/50"
                }`}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/60">
                <Image
                  src={anime.poster}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block truncate text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                    {anime.title}
                  </span>
                  {isDonghuaItem ? (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-amber-500 border border-amber-500/30">
                      Donghua
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star
                    className="h-3 w-3 shrink-0 fill-primary text-primary"
                    aria-hidden="true"
                  />
                  {formatRating(anime.rating)}
                  <span aria-hidden="true">·</span>
                  {anime.type === "Movie"
                    ? "Movie"
                    : anime.episodes > 0
                    ? `${anime.episodes} eps`
                    : anime.status === "Ongoing"
                    ? "Ongoing"
                    : "Series"}
                  <span aria-hidden="true">·</span>
                  {anime.year}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors duration-200 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
