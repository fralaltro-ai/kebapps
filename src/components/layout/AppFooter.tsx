"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/cookie-policy", label: "Cookie" },
  { href: "/terms", label: "Termini" },
] as const;

export default function AppFooter() {
  const pathname = usePathname();
  if (pathname === "/map") return null;

  const containerClass =
    pathname === "/"
      ? "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
      : pathname === "/privacy-policy" || pathname === "/cookie-policy" || pathname === "/terms"
        ? "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8"
        : "max-w-4xl mx-auto px-4";

  return (
    <footer
      aria-label="Informative legali"
      className={`${containerClass} w-full pt-0 pb-[calc(var(--dock-space)+0.5rem)] sm:pb-8 font-quicksand`}
    >
      <div className="bg-card rounded-3xl border border-border shadow-flat px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>Informative</span>
        </div>

        <nav
          aria-label="Collegamenti legali"
          className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2"
        >
          {LEGAL_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider text-center inline-flex items-center justify-center transition-colors flat-press ${
                  active
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-muted/50 hover:bg-primary/10 text-foreground hover:text-primary border-border hover:border-primary/30"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
