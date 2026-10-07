import { canManageTeachers, getCurrentUser } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { TrainerImportClient } from "@/components/teachers/TrainerImportClient";

export const dynamic = "force-dynamic";

export default async function TrainerImportPage() {
  const user = await getCurrentUser();
  if (!canManageTeachers(user.role)) {
    return <AccessDenied message="Only the owner or an academic coordinator can import trainers." />;
  }
  return <TrainerImportClient />;
}
