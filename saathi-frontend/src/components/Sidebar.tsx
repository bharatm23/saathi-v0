"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, MessageSquare, ClipboardList, Sparkles } from "lucide-react";

const items = [
  { href: "/dashboard",        label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports",   icon: FileText },
  { href: "/chat",    label: "Chat",      icon: MessageSquare },
  { href: "/brief",   label: "Brief",     icon: ClipboardList },
  { href: "/digest",  label: "Digest",    icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-navy text-white flex flex-col sticky top-0 h-screen">
      <div className="px-5 pt-6 pb-8">
        <div className="text-[18px] font-bold leading-none">Saathi</div>
        <div className="text-[12px] text-blue-300/80 mt-1.5">Your family&apos;s health memory</div>
      </div>
      <nav className="px-3 flex-1 space-y-1">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-colors ${
                active ? "bg-white/15 text-white font-medium" : "text-blue-200 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-white/10 text-[11px] leading-[1.45] text-blue-400">
        Saathi shows your data<br />Not medical advice
      </div>
    </aside>
  );
}
