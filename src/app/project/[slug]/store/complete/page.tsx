import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

export default async function StoreCompleteRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/project/${slug}`);
}
