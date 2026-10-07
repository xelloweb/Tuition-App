"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus, Power, UserPlus } from "lucide-react";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { formatInTimeZone } from "@/lib/timezones";
import type { UserListItem } from "@/lib/services/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  COORDINATOR: "Academic coordinator",
  ACCOUNTS: "Accounts",
  TEACHER: "Trainer",
};

const STATUS: Record<UserListItem["status"], { label: string; className: string }> = {
  ACTIVE: { label: "Can sign in", className: "border-emerald-400/40 text-emerald-200" },
  LINK_PENDING: { label: "Link not used yet", className: "border-sky-300/40 text-sky-200" },
  NO_PASSWORD: { label: "No password", className: "border-amber-300/40 text-amber-200" },
  DEACTIVATED: { label: "Switched off", className: "border-line-strong text-ink-subtle" },
};

type LinkInfo = { name: string; link: string; expiresAt: string; created: boolean };

function LinkPanel({ info, onDone }: { info: LinkInfo; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Notice tone="success" title={info.created ? `Login created for ${info.name}` : `Reset link created for ${info.name}`}>
      <p>
        Send this link to {info.name} yourself (for example on WhatsApp). It works once and expires{" "}
        {formatInTimeZone(info.expiresAt)} IST. Anyone with the link can set the password, so send it only to them.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="setup-link">Password link</label>
        <input
          id="setup-link"
          readOnly
          value={info.link}
          onFocus={(e) => e.currentTarget.select()}
          className={`${controlClass} ${controlBorder(false)} font-mono text-xs sm:text-xs`}
        />
        <Button type="button" variant="secondary" icon={Copy} onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </Notice>
  );
}

function AddLoginForm({ onCreated, onCancel }: { onCreated: (user: UserListItem, link: LinkInfo) => void; onCancel: () => void }) {
  const submitting = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("COORDINATOR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const data = await apiRequest<{ user: UserListItem; setupLink: string; expiresAt: string }>("/api/users", {
        method: "POST",
        body: { name, email, role },
      });
      onCreated(data.user, { name: data.user.name, link: data.setupLink, expiresAt: data.expiresAt, created: true });
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "Could not create the login."));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-ink">Add a staff login</h2>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" required error={fieldErrors.name}>
          {(p) => (
            <input {...p} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.name)}`} />
          )}
        </Field>
        <Field label="Email address" name="email" required error={fieldErrors.email} hint="They sign in with this address.">
          {(p) => (
            <input {...p} type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.email)}`} />
          )}
        </Field>
        <Field
          label="Role"
          name="role"
          required
          error={fieldErrors.role}
          hint="Coordinators manage students, trainers and schedules. Accounts handle invoices and payments. Owners can do everything, including logins."
          className="sm:col-span-2"
        >
          {(p) => (
            <select {...p} value={role} onChange={(e) => setRole(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.role)}`}>
              <option value="COORDINATOR">Academic coordinator</option>
              <option value="ACCOUNTS">Accounts</option>
              <option value="OWNER">Owner</option>
            </select>
          )}
        </Field>
      </div>
      <p className="text-sm text-ink-subtle">
        Trainer logins are created from the Trainers page (Invite), so they stay linked to the trainer&apos;s classes.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving} icon={UserPlus}>
          Create login
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditLogin({ user, onSaved, onCancel }: { user: UserListItem; onSaved: (u: UserListItem) => void; onCancel: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ user: UserListItem }>(`/api/users/${user.id}`, { method: "PATCH", body: { name, email, role } });
      onSaved(data.user);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "Could not save the login."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-3 border-t border-line pt-3">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Full name" name="name" required error={fieldErrors.name}>
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.name)}`} />}
        </Field>
        <Field label="Email address" name="email" required error={fieldErrors.email}>
          {(p) => <input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.email)}`} />}
        </Field>
        <Field label="Role" name="role" required error={fieldErrors.role}>
          {(p) => (
            <select {...p} value={role} onChange={(e) => setRole(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.role)}`}>
              <option value="COORDINATOR">Academic coordinator</option>
              <option value="ACCOUNTS">Accounts</option>
              <option value="OWNER">Owner</option>
            </select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving}>Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

export function UsersClient({ users: initialUsers, currentUserId }: { users: UserListItem[]; currentUserId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const replace = (u: UserListItem) => setUsers((prev) => (prev.some((p) => p.id === u.id) ? prev.map((p) => (p.id === u.id ? u : p)) : [u, ...prev]));

  const toggleActive = async (u: UserListItem) => {
    if (u.active && !confirm(`Switch off the login for ${u.name}? They are signed out at once and cannot sign in until you switch it back on.`)) return;
    setBusyId(u.id);
    setMessage(null);
    try {
      const data = await apiRequest<{ user: UserListItem }>(`/api/users/${u.id}`, { method: "PATCH", body: { active: !u.active } });
      replace(data.user);
      setMessage({ tone: "success", text: `${data.user.name}'s login is now ${data.user.active ? "on" : "off"}.` });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err, "Could not change the login.") });
    } finally {
      setBusyId(null);
    }
  };

  const resetLink = async (u: UserListItem) => {
    if (!confirm(`Create a new password link for ${u.name}? Their current password stops working now and they are signed out everywhere.`)) return;
    setBusyId(u.id);
    setMessage(null);
    try {
      const data = await apiRequest<{ user: UserListItem; setupLink: string; expiresAt: string }>(`/api/users/${u.id}/reset-link`, { method: "POST" });
      replace(data.user);
      setLink({ name: data.user.name, link: data.setupLink, expiresAt: data.expiresAt, created: false });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err, "Could not create the link.") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & logins"
        context="Settings"
        description="Create staff logins, switch logins off and create password links. Nothing is emailed: copy each link and send it to the person yourself."
        actions={
          !adding && (
            <Button icon={Plus} onClick={() => { setAdding(true); setLink(null); }}>
              Add staff login
            </Button>
          )
        }
      />

      {message && <Notice tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</Notice>}
      {link && <LinkPanel info={link} onDone={() => setLink(null)} />}
      {adding && (
        <AddLoginForm
          onCancel={() => setAdding(false)}
          onCreated={(u, info) => {
            replace(u);
            setAdding(false);
            setLink(info);
            router.refresh();
          }}
        />
      )}

      <section aria-labelledby="logins-heading" className="space-y-3">
        <h2 id="logins-heading" className="text-lg font-semibold text-ink">
          All logins ({users.length})
        </h2>
        <ul className="space-y-3">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isTrainer = u.role === "TEACHER";
            const status = STATUS[u.status];
            return (
              <li key={u.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink break-words">
                      {u.name} {isSelf && <span className="text-sm font-normal text-ink-subtle">(you)</span>}
                    </p>
                    <p className="text-sm text-ink-muted break-all">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-ink-muted">{ROLE_LABELS[u.role] ?? u.role}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 ${status.className}`}>{status.label}</span>
                    </div>
                    {isTrainer && u.trainerName && (
                      <p className="mt-2 text-sm text-ink-subtle">Linked to trainer profile: {u.trainerName}</p>
                    )}
                    {u.linkExpiresAt && (
                      <p className="mt-1 text-sm text-ink-subtle">Link expires {formatInTimeZone(u.linkExpiresAt)} IST</p>
                    )}
                  </div>
                  {!isSelf && (
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {u.active && (
                        <Button variant="secondary" size="sm" icon={KeyRound} loading={busyId === u.id} onClick={() => resetLink(u)}>
                          New password link
                        </Button>
                      )}
                      {!isTrainer && u.active && editingId !== u.id && (
                        <Button variant="outline" size="sm" onClick={() => setEditingId(u.id)}>
                          Edit
                        </Button>
                      )}
                      <Button
                        variant={u.active ? "outline" : "secondary"}
                        size="sm"
                        icon={Power}
                        disabled={busyId === u.id}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? "Switch off" : "Switch on"}
                      </Button>
                    </div>
                  )}
                </div>
                {editingId === u.id && (
                  <EditLogin
                    user={u}
                    onCancel={() => setEditingId(null)}
                    onSaved={(saved) => {
                      replace(saved);
                      setEditingId(null);
                      setMessage({ tone: "success", text: `${saved.name}'s login was updated.` });
                      router.refresh();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
