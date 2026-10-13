import AnimeCard from "@/components/AnimeCard";

/**
 * Responsive poster grid. Pass `className` to override or extend
 * the default column behavior.
 */
export default function AnimeGrid({
  animes = [],
  episodeBadge = false,
  className = "",
}) {
  if (!animes || animes.length === 0) return null;

  return (
    <div
      className={`grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${className}`}
    >
      {animes.map((anime) => (
        <AnimeCard key={anime.id} anime={anime} episodeBadge={episodeBadge} />
      ))}
    </div>
  );
}
