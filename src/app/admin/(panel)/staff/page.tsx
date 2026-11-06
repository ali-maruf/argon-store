import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/lib/auth";
import { adminMutation, fdStr } from "@/lib/admin";
import { dateTime } from "@/lib/format";
import { Notice, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Staff & roles" };

async function inviteStaff(fd: FormData) {
  "use server";
  const email = fdStr(fd, "email").toLowerCase(); const name = fdStr(fd, "name"); const roleId = fdStr(fd, "roleId");
  const temp = randomBytes(9).toString("base64url");
  await adminMutation("staff.manage", "create_staff", "admin_user", email, async () => db.adminUser.create({ data: { email, name, roleId, passwordHash: await bcrypt.hash(temp, 12) } }), { details: { email, roleId } });
  redirect(`/admin/staff?msg=${encodeURIComponent(`Created ${email}. Temporary password: ${temp} — share it privately; 2FA setup is required at first login.`)}`);
}
async function updateStaff(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id"); const op = fdStr(fd, "op");
  const me = await requireAdmin("staff.manage");
  if (id === me.id && op !== "role") throw new Error("You can't do that to your own account here");
  await adminMutation("staff.manage", `staff_${op}`, "admin_user", id, async () => {
    if (op === "role") { if (id === me.id) throw new Error("Can't change your own role"); return db.adminUser.update({ where: { id }, data: { roleId: fdStr(fd, "roleId") } }); }
    if (op === "toggle") { const u = await db.adminUser.findUniqueOrThrow({ where: { id } }); await db.adminSession.updateMany({ where: { userId: id }, data: { revoked: true } }); return db.adminUser.update({ where: { id }, data: { active: !u.active } }); }
    if (op === "reset2fa") { await db.adminSession.updateMany({ where: { userId: id }, data: { revoked: true } }); return db.adminUser.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } }); }
  });
  revalidatePath("/admin/staff");
}
async function saveRole(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  const perms = PERMISSIONS.filter((p) => fd.get(p) === "on");
  await adminMutation("staff.manage", "update_role", "role", id, async () => {
    const r = await db.role.findUniqueOrThrow({ where: { id } });
    if (r.name === "Owner") throw new Error("The Owner role always has every permission");
    return db.role.update({ where: { id }, data: { permissions: perms } });
  }, { details: { perms } });
  revalidatePath("/admin/staff");
}
async function revokeSession(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  await adminMutation("staff.manage", "revoke_session", "admin_session", id, async () => db.adminSession.update({ where: { id }, data: { revoked: true } }));
  revalidatePath("/admin/staff");
}
async function changeOwnPassword(fd: FormData) {
  "use server";
  const me = await requireAdmin();
  const u = await db.adminUser.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(fdStr(fd, "current"), u.passwordHash))) redirect("/admin/staff?e=Current password is wrong");
  const next = fdStr(fd, "next");
  if (next.length < 10) redirect("/admin/staff?e=Use at least 10 characters");
  await adminMutation("settings.edit", "change_password", "admin_user", me.id, async () => db.adminUser.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 12) } }));
  redirect("/admin/staff?msg=Password changed");
}

export default async function Staff({ searchParams }: { searchParams: Promise<{ msg?: string; e?: string }> }) {
  const me = await requireAdmin("staff.manage");
  const sp = await searchParams;
  const [users, roles, sessions] = await Promise.all([
    db.adminUser.findMany({ include: { role: true }, orderBy: { createdAt: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.adminSession.findMany({ where: { revoked: false, expiresAt: { gt: new Date() } }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <PageHeader title="Staff & roles" />
      <Notice msg={sp.msg} error={sp.e} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <div className="card-h">Staff accounts</div>
          <table className="t">
            <thead><tr><th>Name</th><th>Role</th><th>2FA</th><th>Last login</th><th /></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}>
                <td><div className="font-medium">{u.name}{u.id === me.id && " (you)"}</div><div className="text-[12px] text-[var(--muted)]">{u.email}</div>{!u.active && <span className="chip chip-red">deactivated</span>}</td>
                <td><form action={updateStaff} className="flex gap-1"><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="role" /><select name="roleId" defaultValue={u.roleId} className="input !w-auto" disabled={u.id === me.id}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{u.id !== me.id && <button className="btn btn-ghost">Set</button>}</form></td>
                <td>{u.totpEnabled ? <span className="chip chip-green">on</span> : <span className="chip chip-yellow">pending setup</span>}</td>
                <td className="text-[12px]">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "never"}</td>
                <td>{u.id !== me.id && <div className="flex gap-1">
                  <form action={updateStaff}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="toggle" /><button className="btn btn-ghost">{u.active ? "Deactivate" : "Activate"}</button></form>
                  <form action={updateStaff}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="reset2fa" /><button className="btn btn-ghost">Reset 2FA</button></form>
                </div>}</td>
              </tr>
            ))}</tbody>
          </table>
          <form action={inviteStaff} className="grid gap-2 border-t border-[var(--line)] p-4 sm:grid-cols-4">
            <input name="name" required placeholder="Name" className="input" /><input name="email" type="email" required placeholder="Email" className="input" />
            <select name="roleId" className="input">{roles.filter((r) => r.name !== "Owner").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <button className="btn btn-primary">Add staff</button>
          </form>
        </div>
        <div className="space-y-5">
          <div className="card">
            <div className="card-h">Active sessions</div>
            <ul className="divide-y divide-[var(--line)] text-[12px]">{sessions.map((s) => <li key={s.id} className="flex items-center gap-2 px-4 py-2"><span className="flex-1"><b>{s.user.name}</b> · {s.ip ?? "?"}<br /><span className="text-[var(--muted)]">{s.userAgent?.slice(0, 50)} · {dateTime(s.createdAt)}</span></span>{s.id !== me.sessionId ? <form action={revokeSession}><input type="hidden" name="id" value={s.id} /><button className="chip">Revoke</button></form> : <span className="chip chip-green">this</span>}</li>)}</ul>
          </div>
          <form action={changeOwnPassword} className="card">
            <div className="card-h">Change my password<button className="btn btn-primary">Save</button></div>
            <div className="card-b space-y-2"><input name="current" type="password" placeholder="Current password" className="input" required autoComplete="current-password" /><input name="next" type="password" placeholder="New password (10+ chars)" className="input" required autoComplete="new-password" /></div>
          </form>
        </div>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <div className="card-h">Role permissions</div>
        <table className="t text-[12px]">
          <thead><tr><th>Permission</th>{roles.map((r) => <th key={r.id} className="text-center">{r.name}</th>)}</tr></thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}><td className="font-mono">{p}</td>{roles.map((r) => <td key={r.id} className="text-center"><input type="checkbox" form={`role-${r.id}`} name={p} defaultChecked={r.permissions.includes(p)} disabled={r.name === "Owner"} aria-label={`${r.name} ${p}`} /></td>)}</tr>
            ))}
            <tr><td />{roles.map((r) => <td key={r.id} className="text-center">{r.name !== "Owner" && <form id={`role-${r.id}`} action={saveRole}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost">Save</button></form>}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
