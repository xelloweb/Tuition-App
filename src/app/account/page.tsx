import { getCurrentUser } from "@/lib/auth";
import { AccountSettings } from "@/components/account/AccountSettings";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  return <AccountSettings name={user.name} email={user.email} />;
}
