import { redirect } from "next/navigation";

export default function ConditionerStart() {
  redirect("/m/conditioner/profile?step=1");
}
