import { redirect } from "next/navigation";

export default function ShampooStart() {
  redirect("/m/shampoo/profile?step=1");
}
