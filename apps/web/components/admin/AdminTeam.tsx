"use client";

import {
  AlertTriangle,
  Copy,
  History,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import {
  AccessRole,
  AuditLog,
  PermissionGroup,
  StaffMember,
  createAccessRole,
  createStaff,
  deactivateStaff,
  deleteAccessRole,
  duplicateAccessRole,
  fetchAccessRoles,
  fetchAuditLogs,
  fetchPermissionCatalogue,
  fetchStaff,
  sendStaffResetLink,
  updateAccessRole,
  updateStaff
} from "../../lib/catalog";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  useAdminToast
} from "./AdminShared";

type TeamView = "staff" | "roles" | "audit";

export function AdminTeam() {
  const { user } = useAuth();
  const can = useCallback(
    (permission: string) =>
      Boolean(user?.permissions.includes("*") || user?.permissions.includes(permission)),
    [user]
  );
  const availableViews = useMemo<TeamView[]>(() => [
    ...(can("staff.read") ? ["staff" as const] : []),
    ...(can("roles.read") ? ["roles" as const] : []),
    ...(can("audit.read") ? ["audit" as const] : [])
  ], [can]);
  const [view, setView] = useState<TeamView>("staff");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [editingRole, setEditingRole] = useState<AccessRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { message, kind, notify } = useAdminToast();
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<AccessRole | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [members, accessRoles, catalogue, audit] = await Promise.all([
        can("staff.read") ? fetchStaff() : Promise.resolve([]),
        can("roles.read") ? fetchAccessRoles() : Promise.resolve([]),
        can("roles.read") ? fetchPermissionCatalogue() : Promise.resolve([]),
        can("audit.read") ? fetchAuditLogs() : Promise.resolve([])
      ]);
      setStaff(members);
      setRoles(accessRoles);
      setGroups(catalogue);
      setLogs(audit);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Access management is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [can]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!availableViews.includes(view) && availableViews[0]) setView(availableViews[0]);
  }, [availableViews, view]);

  function beginRole(role?: AccessRole) {
    setEditingRole(role ?? null);
    setRoleName(role?.name ?? "");
    setRoleDescription(role?.description ?? "");
    setSelectedPermissions(role?.permissions.filter((item) => item !== "*") ?? []);
    setView("roles");
  }

  function togglePermission(permission: string) {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  function toggleGroup(group: PermissionGroup) {
    const keys = group.permissions.map((item) => item.key);
    const allSelected = keys.every((key) => selectedPermissions.includes(key));
    setSelectedPermissions((current) =>
      allSelected
        ? current.filter((key) => !keys.includes(key))
        : [...new Set([...current, ...keys])]
    );
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const input = {
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions
      };
      const saved = editingRole
        ? await updateAccessRole(editingRole.id, input)
        : await createAccessRole(input);
      setRoles((current) =>
        editingRole
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name))
      );
      beginRole(saved);
      notify(`${saved.name} was saved. Assigned staff receive changes immediately.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "The access role could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function copyRole(role: AccessRole) {
    try {
      const copied = await duplicateAccessRole(role.id);
      setRoles((current) => [...current, copied]);
      beginRole(copied);
      notify("Role duplicated. Review its name and permissions before assigning staff.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Role could not be duplicated.", "error");
    }
  }

  async function removeRole(role: AccessRole) {
    try {
      await deleteAccessRole(role.id);
      setRoles((current) => current.filter((item) => item.id !== role.id));
      if (editingRole?.id === role.id) beginRole();
      notify(`${role.name} was deleted.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Role could not be deleted.", "error");
    } finally {
      setDeleteRoleTarget(null);
    }
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    try {
      const created = await createStaff({
        name: String(data.get("name")),
        email: String(data.get("email")),
        password: String(data.get("password")),
        accessRoleId: String(data.get("accessRoleId"))
      });
      setStaff((current) => [created, ...current]);
      form.reset();
      notify(`${created.name} can now sign in with ${created.accessRole?.name ?? "the assigned role"}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Staff member could not be created.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(member: StaffMember, accessRoleId: string) {
    try {
      const updated = await updateStaff(member.id, { accessRoleId });
      setStaff((current) => current.map((item) => item.id === member.id ? updated : item));
      notify(`${member.name}'s access was updated immediately.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Role could not be assigned.", "error");
    }
  }

  async function deactivate(member: StaffMember) {
    try {
      const updated = await deactivateStaff(member.id);
      setStaff((current) => current.map((item) => item.id === member.id ? updated : item));
      notify(`${member.name} can no longer sign in.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Staff access could not be changed.", "error");
    } finally {
      setDeactivateTarget(null);
    }
  }

  async function reactivate(member: StaffMember) {
    try {
      const updated = await updateStaff(member.id, { isActive: true });
      setStaff((current) => current.map((item) => item.id === member.id ? updated : item));
      notify(`${member.name} can sign in again.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Staff access could not be changed.", "error");
    }
  }

  async function sendResetLink(member: StaffMember) {
    try {
      await sendStaffResetLink(member.id);
      notify(`A password reset link was sent to ${member.email}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "The reset link could not be sent.", "error");
    }
  }

  const assignableRoles = roles.filter((role) => role.isActive && role.key !== "owner");
  const editingProtectedSystem = editingRole?.isSystem === true;

  if (loading && !staff.length && !roles.length) return <AdminLoading label="Loading roles and staff access..." />;
  if (error && !staff.length && !roles.length) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Governance"
        title="Team and access"
        description="Compose reusable permission roles, assign staff, and review sensitive activity."
        actions={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh access data"><RefreshCw size={17} /></button>}
      />
      <nav className="admin-local-nav" aria-label="Team and access sections">
        {availableViews.includes("staff") ? <button type="button" className={view === "staff" ? "active" : ""} onClick={() => setView("staff")}><UsersRound size={16} /> Staff</button> : null}
        {availableViews.includes("roles") ? <button type="button" className={view === "roles" ? "active" : ""} onClick={() => setView("roles")}><KeyRound size={16} /> Access roles</button> : null}
        {availableViews.includes("audit") ? <button type="button" className={view === "audit" ? "active" : ""} onClick={() => setView("audit")}><History size={16} /> Audit log</button> : null}
      </nav>
      <AdminToast message={message} kind={kind} />

      {deleteRoleTarget ? (
        <AdminConfirmDialog
          title={`Delete ${deleteRoleTarget.name}?`}
          onCancel={() => setDeleteRoleTarget(null)}
          onConfirm={() => void removeRole(deleteRoleTarget)}
        />
      ) : null}

      {deactivateTarget ? (
        <AdminConfirmDialog
          title={`Deactivate ${deactivateTarget.name}?`}
          body="They will immediately lose access to the admin console."
          confirmLabel="Deactivate"
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() => void deactivate(deactivateTarget)}
        />
      ) : null}

      {view === "staff" ? (
        <>
          {can("staff.create") ? (
            <section className="admin-data-panel">
              <AdminSectionHeader title="Create staff login" description="Every staff account must use one reusable access role." />
              <form className="admin-inline-form" onSubmit={addStaff}>
                <div className="form-grid">
                  <label>Full name<input name="name" placeholder="Team member name" required /></label>
                  <label>Work email<input name="email" type="email" placeholder="name@company.com" required /></label>
                </div>
                <div className="form-grid">
                  <label>Temporary password<input name="password" type="password" minLength={8} placeholder="At least 8 characters" required /></label>
                  <label>Access role
                    <select name="accessRoleId" required defaultValue="">
                      <option value="" disabled>Select a role</option>
                      {assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <small>The role controls every dashboard page and action this person can use.</small>
                  </label>
                </div>
                <button className="primary-action" type="submit" disabled={saving || !assignableRoles.length}><UserPlus size={17} /> Create staff login</button>
              </form>
            </section>
          ) : null}

          <section className="admin-data-panel">
            <AdminSectionHeader title="Staff access" description={`${staff.filter((item) => item.isActive).length} active staff accounts`} />
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Team member</th><th>Role</th><th>Permission scope</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{staff.map((member) => {
                  const protectedAccount = member.role === "OWNER";
                  const assigned = roles.find((role) => role.id === member.accessRole?.id);
                  return (
                    <tr key={member.id}>
                      <td><strong>{member.name}</strong><small>{member.email} · Joined {new Date(member.createdAt).toLocaleDateString("en-BD")}</small></td>
                      <td>
                        {can("staff.update") && !protectedAccount ? (
                          <select value={member.accessRole?.id ?? ""} onChange={(event) => void changeRole(member, event.target.value)}>
                            <option value="" disabled>Legacy role</option>
                            {assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                          </select>
                        ) : <strong>{member.accessRole?.name ?? (protectedAccount ? "Owner" : member.role)}</strong>}
                      </td>
                      <td><span className="admin-scope-count">{assigned?.permissions.includes("*") ? "Full access" : `${assigned?.permissions.length ?? member.permissions?.length ?? 0} permissions`}</span></td>
                      <td><span className={`admin-status-dot ${member.isActive ? "active" : ""}`}>{member.isActive ? "Active" : "Inactive"}</span></td>
                      <td>
                        {protectedAccount ? "Protected" : !can("staff.deactivate") ? "—" : (
                          <div className="admin-row-actions">
                            {member.isActive ? (
                              <button type="button" onClick={() => setDeactivateTarget(member)}><UserMinus size={15} /> Deactivate</button>
                            ) : (
                              <button type="button" onClick={() => void reactivate(member)}><UserCheck size={15} /> Reactivate</button>
                            )}
                            {member.isActive && can("staff.update") ? (
                              <button type="button" onClick={() => void sendResetLink(member)} title="Send password reset link"><KeyRound size={15} /> Reset link</button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {view === "roles" ? (
        <div className="admin-access-workspace">
          <section className="admin-data-panel admin-role-list">
            <AdminSectionHeader
              title="Access roles"
              description="Presets are maintained by the platform. Duplicate one for a tailored role."
              action={can("roles.create") ? <button type="button" className="secondary-action" onClick={() => beginRole()}><Plus size={16} /> New role</button> : undefined}
            />
            {roles.map((role) => (
              <button type="button" className={editingRole?.id === role.id ? "active" : ""} key={role.id} onClick={() => beginRole(role)}>
                <span><strong>{role.name}</strong><small>{role.description ?? "Custom access policy"}</small></span>
                <span><b>{role.permissions.includes("*") ? "All" : role.permissions.length}</b><small>permissions · {role._count.users} staff</small></span>
              </button>
            ))}
          </section>

          <form className="admin-data-panel admin-role-editor" onSubmit={saveRole}>
            <AdminSectionHeader
              title={editingRole ? `Edit ${editingRole.name}` : "Create access role"}
              description="Use least privilege: select only the actions required for this job."
              action={editingRole && can("roles.create") ? <button type="button" title="Duplicate role" onClick={() => void copyRole(editingRole)}><Copy size={16} /> Duplicate</button> : undefined}
            />
            {editingProtectedSystem ? (
              <div className="admin-protected-notice"><ShieldCheck size={19} /><span><strong>Protected preset policy</strong><small>Platform presets cannot be edited. Duplicate this role to create a tailored policy.</small></span></div>
            ) : (
              <>
                <div className="form-grid">
                  <label>Role name<input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="For example, Fulfillment lead" required /></label>
                  <label>Description<input value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="What this role is responsible for" /></label>
                </div>
                <div className="admin-permission-summary">
                  <span><KeyRound size={17} /><strong>{selectedPermissions.length}</strong> permissions selected</span>
                  {selectedPermissions.some((key) => groups.flatMap((group) => group.permissions).find((item) => item.key === key)?.risk === "high") ? <span className="risk"><AlertTriangle size={16} /> Includes high-impact actions</span> : null}
                </div>
                <div className="admin-permission-groups">
                  {groups.map((group) => {
                    const keys = group.permissions.map((item) => item.key);
                    const selectedCount = keys.filter((key) => selectedPermissions.includes(key)).length;
                    return (
                      <section key={group.key}>
                        <header><span><strong>{group.label}</strong><small>{selectedCount} of {keys.length} selected</small></span><button type="button" onClick={() => toggleGroup(group)}>{selectedCount === keys.length ? "Clear group" : "Select group"}</button></header>
                        <div>{group.permissions.map((item) => (
                          <label key={item.key} className={item.risk === "high" ? "high-impact" : ""}>
                            <input type="checkbox" checked={selectedPermissions.includes(item.key)} onChange={() => togglePermission(item.key)} />
                            <span><strong>{item.label}{item.risk === "high" ? <AlertTriangle size={13} /> : null}</strong><small>{item.description}</small></span>
                          </label>
                        ))}</div>
                      </section>
                    );
                  })}
                </div>
                <footer className="admin-editor-actions">
                  {editingRole && !editingRole.isSystem && can("roles.delete") ? <button className="danger-action" type="button" disabled={editingRole._count.users > 0} onClick={() => setDeleteRoleTarget(editingRole)} title={editingRole._count.users ? "Reassign staff before deleting" : "Delete role"}><Trash2 size={16} /> Delete</button> : <span />}
                  {can(editingRole ? "roles.update" : "roles.create") ? <button className="primary-action" type="submit" disabled={saving || !roleName.trim()}><Pencil size={16} /> {saving ? "Saving..." : "Save role"}</button> : null}
                </footer>
              </>
            )}
          </form>
        </div>
      ) : null}

      {view === "audit" ? (
        <section className="admin-data-panel">
          <AdminSectionHeader title="Audit history" description="Newest administrative changes appear first" />
          <div className="admin-audit-list">
            {logs.map((log) => (
              <article key={log.id}>
                <span><ShieldCheck size={16} /></span>
                <div><strong>{log.action.replace(/[._]/g, " ")}</strong><p>{log.actor?.name ?? "System"} · {log.entity}{log.entityId ? ` · ${log.entityId}` : ""}</p></div>
                <time>{new Date(log.createdAt).toLocaleString("en-BD")}</time>
              </article>
            ))}
            {!logs.length ? <p>No administrative changes have been recorded yet.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
