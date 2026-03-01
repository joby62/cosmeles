import { redirect } from "next/navigation";

export default async function ProductPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  redirect(`/product/${id}`);
}
