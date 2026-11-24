"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ShareButton from "../ui/ShareButton";
import { User as UserIcon, Home, Map, BookOpen, Bookmark } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useVisualViewportOffset } from "@/hooks/useVisualViewportOffset";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: Home },
  { name: "Mappa", href: "/map", icon: Map },
  { name: "Diario", href: "/diary", icon: BookOpen },
  { name: "Wishlist", href: "/wishlist", icon: Bookmark },
] as const;

export default function Navigation() {
  const pathname = usePathname();
  const { keyboardOpen } = useVisualViewportOffset();

  useEffect(() => {
    const shell = document.getElementById("app-shell-scroll");
    if (shell) {
      shell.scrollTop = 0;
    }
  }, [pathname]);

  const isActivePath = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(`${href}/`);
  const isProfileActive = isActivePath("/profile");

  return (
    <>
      <nav className="bg-card border-b border-border fixed top-0 left-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo Section */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group flat-press" aria-label="KebApps Home">
                <div className="size-8 sm:size-9 flex items-center justify-center">
                  <Image
                    src="/logo.svg"
                    alt="KebApps Logo"
                    width={36}
                    height={36}
                    className="w-full h-full"
                    priority
                  />
                </div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-quicksand whitespace-nowrap">
                  Keb<span className="text-primary">Apps</span>
                </span>
              </Link>

              {/* Desktop Menu */}
              <div className="hidden sm:ml-10 sm:flex sm:space-x-6">
                {NAV_ITEMS.map((item) => {
                  const active = isActivePath(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${
                        active
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-peach/50"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              <ShareButton />
              <Link
                href="/profile"
                onClick={() => triggerHaptic("light")}
                aria-current={isProfileActive ? "page" : undefined}
                className={cn(
                  "border size-9 sm:h-9 sm:w-auto sm:px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 flat-press shadow-sm",
                  isProfileActive
                    ? "bg-primary/15 text-primary border-primary/50"
                    : "bg-card hover:bg-primary/10 text-foreground hover:text-primary border-border hover:border-primary/50"
                )}
                aria-label="Profilo e Dati Locali"
              >
                <span className="hidden sm:inline font-black uppercase tracking-widest text-xs">Profilo</span>
                <UserIcon className="size-4 text-primary" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom navigation dock */}
      <div
        className={`sm:hidden fixed left-3 right-3 z-[100] bottom-[calc(var(--dock-gap)+var(--safe-b))] transition-opacity duration-150 ${
          keyboardOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="bg-card rounded-3xl border border-border shadow-dropdown grid grid-cols-4 items-center h-16 px-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.name}
                aria-current={active ? "page" : undefined}
                onClick={() => triggerHaptic("light")}
                className={`flex flex-col items-center justify-center gap-0.5 py-1 group flat-press-icon ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? "bg-primary/15 text-primary" : ""}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tight leading-none">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
