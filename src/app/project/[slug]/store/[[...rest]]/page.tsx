import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

/** Legacy /store URLs redirect to the public project page (no storefront). */
export default async function LegacyStoreRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/project/${slug}`);
}
