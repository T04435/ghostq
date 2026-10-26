import { redirect } from "next/navigation";

/** How it works lives on the Landing now (#how; the user, 26 Oct); old links land there. */
export default function HowPage() {
  redirect("/#how");
}
