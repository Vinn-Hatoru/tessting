import { redirect } from "next/navigation";

export default async function WatchSlugRedirect({ params }) {
  const { slug } = await params;
  redirect(`/watch/${slug}/1`);
}
