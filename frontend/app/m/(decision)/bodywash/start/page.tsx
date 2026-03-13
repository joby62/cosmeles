import { redirect } from "next/navigation";

export default function BodyWashStart() {
  redirect("/m/bodywash/profile?step=1");
}
