"use client";

import { RefreshCw, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AuditLog,
  AuthUser,
  StaffMember,
  createStaff,
  deactivateStaff,
  fetchAuditLogs,
  fetchStaff,
  updateStaff
} from "../../lib/catalog";
import { AdminError, AdminLoading, AdminPageTitle, AdminSectionHeader } from "./AdminShared";

const staffRoles: AuthUser["role"][] = [
  "ADMIN",
  "OWNER",
  "OPERATIONS",
  "CATALOG",
  "SUPPORT",
  "ANALYST"
];

export function AdminTeam() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [members, audit] = await Promise.all([fetchStaff(), fetchAuditLogs()]);
      setStaff(members);
      setLogs(audit);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Team controls are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeRole(member: StaffMember, role: AuthUser["role"]) {
    try {
      await updateStaff(member.id, {
        role,
        permissions: member.permissions.map((item) => item.permission)
      });
      setStaff((current) =>
        current.map((item) => item.id === member.id ? { ...item, role } : item)
      );
      setMessage(`${member.name} is now ${role.toLowerCase()}.`);
      const audit = await fetchAuditLogs();
      setLogs(audit);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Role could not be changed.");
    }
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const created = await createStaff({
        name: String(data.get("name")),
        email: String(data.get("email")),
        password: String(data.get("password")),
        role: String(data.get("role")) as AuthUser["role"]
      });
      setStaff((current) => [created, ...current]);
      form.reset();
      setMessage(`${created.name} can now sign in.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Staff member could not be created.");
    }
  }

  async function deactivate(member: StaffMember) {
    if (!window.confirm(`Deactivate ${member.name}?`)) return;
    try {
      const updated = await deactivateStaff(member.id);
      setStaff((current) => current.map((item) => item.id === member.id ? updated : item));
      setMessage(`${member.name} can no longer sign in.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Staff access could not be changed.");
    }
  }

  if (loading && !staff.length) return <AdminLoading label="Loading staff access and audit history..." />;
  if (error && !staff.length) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Governance"
        title="Team and audit"
        description="Use focused roles for daily work and retain a history of sensitive changes."
        actions={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh team"><RefreshCw size={17} /></button>}
      />
      {message ? <p className="admin-message">{message}</p> : null}

      <section className="admin-data-panel">
        <AdminSectionHeader title="Invite staff" description="Create a focused login and assign the closest operational role." />
        <form className="admin-inline-form" onSubmit={addStaff}>
          <div className="form-grid"><input name="name" placeholder="Full name" required /><input name="email" type="email" placeholder="Work email" required /></div>
          <div className="form-grid"><input name="password" type="password" minLength={8} placeholder="Temporary password" required /><select name="role" defaultValue="SUPPORT">{staffRoles.filter((role) => role !== "OWNER").map((role) => <option key={role}>{role}</option>)}</select></div>
          <button className="primary-action" type="submit"><UserPlus size={17} /> Create staff login</button>
        </form>
      </section>

      <section className="admin-data-panel">
        <AdminSectionHeader title="Staff access" description="Owners and administrators can assign operational roles" />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Team member</th><th>Joined</th><th>Permissions</th><th>Role</th><th>Access</th></tr></thead>
            <tbody>{staff.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.name}</strong><small>{member.email}</small></td>
                <td>{new Date(member.createdAt).toLocaleDateString("en-BD")}</td>
                <td>{member.permissions.length ? member.permissions.map((item) => item.permission).join(", ") : "Role defaults"}</td>
                <td>
                  <select value={member.role} onChange={(event) => void changeRole(member, event.target.value as AuthUser["role"])}>
                    {staffRoles.map((role) => <option key={role}>{role}</option>)}
                  </select>
                </td>
                <td>{member.isActive ? <button type="button" onClick={() => void deactivate(member)}><UserMinus size={15} /> Deactivate</button> : "Inactive"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-data-panel">
        <AdminSectionHeader title="Audit history" description="Newest administrative changes appear first" />
        <div className="admin-audit-list">
          {logs.map((log) => (
            <article key={log.id}>
              <span><ShieldCheck size={16} /></span>
              <div>
                <strong>{log.action.replace(/_/g, " ")}</strong>
                <p>{log.actor?.name ?? "System"} · {log.entity}{log.entityId ? ` · ${log.entityId}` : ""}</p>
              </div>
              <time>{new Date(log.createdAt).toLocaleString("en-BD")}</time>
            </article>
          ))}
          {!logs.length ? <p>No administrative changes have been recorded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
