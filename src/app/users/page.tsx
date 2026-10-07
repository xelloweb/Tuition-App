import { canManageUsers, getCurrentUser } from "@/lib/auth";
import { listUsers } from "@/lib/services/users";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    return <AccessDenied message="Logins are managed by the owner." />;
  }
  const users = await listUsers();
  return <UsersClient users={users} currentUserId={user.id} />;
}
