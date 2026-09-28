"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/lib/types";
import { taka } from "@/lib/format";
import { cx } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-sm text-white">
        ⚡
      </span>
      <span>
        Dhaka <span className="text-brand">Tesla Pool</span>
      </span>
    </Link>
  );
}

export function AppHeader({ user, onLogout }: { user?: User; onLogout?: () => void }) {
  const pathname = usePathname();
  const base = user?.role === "DRIVER" ? "/driver" : "/passenger";
  const links = user
    ? [
        { href: base, label: user.role === "DRIVER" ? "Trips" : "Ride" },
        { href: `${base}/history`, label: "History" },
      ]
    : [];

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        {user && (
          <div className="flex items-center gap-1 text-sm">
            <nav className="flex items-center gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cx(
                    "rounded-lg px-3 py-1.5 font-medium",
                    pathname === l.href ? "bg-brand/10 text-brand-dark" : "text-muted hover:text-ink",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="ml-2 hidden text-right sm:block">
              <div className="font-semibold leading-tight">{user.name}</div>
              {user.role === "PASSENGER" && (
                <div className="text-xs text-muted">TeslaPay {taka(user.walletBalancePaisa)}</div>
              )}
            </div>
            <button onClick={onLogout} className="ml-2 rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-surface hover:text-ink">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function PageShell({ user, onLogout, children }: { user?: User; onLogout?: () => void; children: React.ReactNode }) {
  return (
    <>
      <AppHeader user={user} onLogout={onLogout} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6">{children}</main>
    </>
  );
}
