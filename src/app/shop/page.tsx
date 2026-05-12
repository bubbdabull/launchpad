import { redirect } from "next/navigation";

export const metadata = {
  title: "Shop · NFT Launchpad",
  description: "Creator storefronts are deprecated — browse launches instead.",
};

export default function ShopPage() {
  redirect("/#launches");
}
