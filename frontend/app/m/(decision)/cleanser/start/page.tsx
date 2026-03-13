import { redirect } from "next/navigation";

export default function CleanserStart() {
  redirect("/m/cleanser/profile?step=1");
}
