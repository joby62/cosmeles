import { redirect } from "next/navigation";

export default function LotionStart() {
  redirect("/m/lotion/profile?step=1");
}
