import React from "react";

/**
 * Standard page heading: the page title is the page's only <h1>.
 * Optional context line above, description below and actions on the right
 * (actions wrap under the title on phones).
 */
export function PageHeader({
  title,
  context,
  description,
  actions,
}: {
  title: string;
  context?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {context && <p className="text-sm font-medium text-ink-subtle">{context}</p>}
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink break-words">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
