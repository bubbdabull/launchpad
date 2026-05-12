import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

/** Storefront removed — project focus is launch + mint. */
export default async function ProjectStoreRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/project/${slug}`);
}
