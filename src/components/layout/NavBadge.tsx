/** Count next to a navigation item, e.g. unread parent submissions. */
export function NavBadge({ count, label = "new" }: { count: number | undefined; label?: string }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold leading-5 text-brand-ink">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
