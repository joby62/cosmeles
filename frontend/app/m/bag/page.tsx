import { redirect } from "next/navigation";

export default function MobileBagRedirectPage() {
  redirect("/m/me?tab=bag");
}
