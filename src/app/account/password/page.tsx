import { redirect } from "next/navigation";

// Older links point here; name and password settings now share /account.
export default function ChangePasswordRedirect() {
  redirect("/account");
}
