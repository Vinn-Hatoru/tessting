import Link from "next/link";
import Container from "@/components/Container";
import HeroSection from "@/components/HeroSection";
import SectionHeader from "@/components/SectionHeader";
import ContinueWatchingSection from "@/components/ContinueWatchingSection";
import AnimeGrid from "@/components/AnimeGrid";
import PopularList from "@/components/PopularList";
import {
  getFeaturedAnime,
  getTrendingAnime,
  getLatestUpdatedAnime,
  getPopularAnime,
  getGenres,
  genreLink,
} from "@/lib/anime";

export default async function HomePage() {
  const featured = await getFeaturedAnime();
  const trending = await getTrendingAnime(6);
  const latest = await getLatestUpdatedAnime(6);
  const popular = await getPopularAnime(10);
  const genres = getGenres();

  return (
    <>
      <HeroSection items={featured} />

      <Container>
        {/* Continue Watching from Cookie */}
        <ContinueWatchingSection />

        {/* Trending */}
        <section id="trending" className="scroll-mt-24 pt-10 sm:pt-12">
          <SectionHeader
            title="Trending Now"
            subtitle="What everyone is watching this week"
            href="/search?sort=trending"
          />
          <AnimeGrid animes={trending} />
        </section>

        {/* Latest episodes */}
        <section id="latest" className="scroll-mt-24 pt-12 sm:pt-14">
          <SectionHeader
            title="Latest Episodes"
            subtitle="Fresh episodes, updated weekly"
            href="/search?sort=latest"
          />
          <AnimeGrid animes={latest} episodeBadge />
        </section>

        {/* Popular */}
        <section id="popular" className="scroll-mt-24 pt-12 sm:pt-14">
          <SectionHeader
            title="Popular Anime"
            subtitle="All-time community favorites"
            href="/search?sort=popular"
          />
          <PopularList animes={popular} />
        </section>

        {/* Genres */}
        <section id="genres" className="scroll-mt-24 pt-12 pb-14 sm:pt-14 sm:pb-16">
          <SectionHeader
            title="Browse by Genre"
            subtitle="Find something that fits your mood"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {genres.map((genre) => (
              <Link
                key={genre.name}
                href={genreLink(genre.name)}
                className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-accent-foreground">
                  {genre.name}
                </span>
                <span className="text-xs text-muted-foreground transition-colors duration-200 group-hover:text-accent-foreground/80">
                  {genre.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
