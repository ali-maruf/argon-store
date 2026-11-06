import Link from "next/link";
import { requireAdmin, can, type Permission } from "@/lib/auth";
import { LogoMark } from "@/components/store/Logo";
import { AdminNav, CommandK, AdminLive, AdminThemeToggle, MobileNavToggle } from "@/components/admin/Shell";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; perm?: Permission; icon: string }[] = [
  { href: "/admin", label: "Dashboard", icon: "◎" },
  { href: "/admin/orders", label: "Orders", perm: "orders.view", icon: "▤" },
  { href: "/admin/products", label: "Products", perm: "products.view", icon: "◇" },
  { href: "/admin/inventory", label: "Inventory", perm: "products.view", icon: "▦" },
  { href: "/admin/collections", label: "Collections", perm: "collections.edit", icon: "◫" },
  { href: "/admin/customers", label: "Customers", perm: "customers.view", icon: "◉" },
  { href: "/admin/discounts", label: "Discounts", perm: "discounts.edit", icon: "%" },
  { href: "/admin/content", label: "Content", perm: "content.edit", icon: "✎" },
  { href: "/admin/reviews", label: "Reviews", perm: "reviews.edit", icon: "★" },
  { href: "/admin/reports", label: "Analytics", perm: "reports.view", icon: "↗" },
  { href: "/admin/marketing", label: "Marketing", perm: "marketing.edit", icon: "✦" },
  { href: "/admin/shipping", label: "Shipping", perm: "shipping.edit", icon: "⇄" },
  { href: "/admin/payments", label: "Payments", perm: "payments.edit", icon: "৳" },
  { href: "/admin/notifications", label: "Notifications", perm: "notifications.edit", icon: "✉" },
  { href: "/admin/staff", label: "Staff & roles", perm: "staff.manage", icon: "☰" },
  { href: "/admin/audit", label: "Audit log", perm: "audit.view", icon: "⌘" },
  { href: "/admin/settings", label: "Settings", perm: "settings.edit", icon: "⚙" },
];

export default async function Panel({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const items = NAV.filter((n) => !n.perm || can(admin, n.perm));
  return (
    <div className="min-h-dvh bg-[var(--bg)] md:grid md:grid-cols-[232px_1fr]">
      <aside id="admin-nav" className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[var(--line)] bg-[var(--bg)] p-3 data-[open=true]:flex md:sticky md:top-0 md:flex md:h-dvh">
        <Link href="/admin" className="mb-4 flex items-center gap-2.5 px-2 py-2"><LogoMark className="h-7 w-7 [--logo-fill:var(--fg)]" /><span className="font-bold tracking-[0.3em]">ARGON</span></Link>
        <AdminNav items={items.map(({ href, label, icon }) => ({ href, label, icon }))} />
        <div className="mt-auto space-y-1 border-t border-[var(--line)] pt-3">
          <a href="/" target="_blank" className="navlink">↗ View store</a>
          <div className="flex items-center justify-between px-2 text-[12px] text-[var(--muted)]"><span className="truncate">{admin.name} · {admin.role}</span><AdminThemeToggle /></div>
          <form action={logout}><button className="navlink w-full">⎋ Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/90 px-4 backdrop-blur md:px-6">
          <MobileNavToggle />
          <CommandK />
          <AdminLive enabled={can(admin, "orders.view")} />
        </header>
        <main className="mx-auto max-w-[1400px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
