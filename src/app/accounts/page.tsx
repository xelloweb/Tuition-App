import { getCurrentUser, canAccessFinancial } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { ApiError } from "@/lib/api-errors";
import { istToday } from "@/lib/accounts-shared";
import { profitAndLoss, readRange } from "@/lib/services/accounts";
import { AccountsClient } from "./AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccessFinancial(user.role)) {
    return <AccessDenied message="Accounts (sales, expenses and profit & loss) are available to the owner and Accounts staff." />;
  }
  const sp = await searchParams;
  const one = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined);
  let rangeError = "";
  let range;
  try {
    range = readRange(one("from"), one("to"), one("basis"));
  } catch (err) {
    rangeError = err instanceof ApiError ? err.message : "That date range could not be used.";
    range = readRange(undefined, undefined, one("basis"));
  }
  const pnl = await profitAndLoss(user, range);
  // A new range starts the page afresh, so the date boxes always show the period on screen.
  return <AccountsClient key={`${range.from}|${range.to}|${range.basis}`} pnl={pnl} today={istToday()} rangeError={rangeError} />;
}
