"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { HOME_FOR } from "@/hooks/useSession";
import { Logo } from "@/components/AppHeader";

export default function Home() {
  const router = useRouter();

  // Already signed in? Go straight to your dashboard.
  useEffect(() => {
    api<{ user: User }>("/auth/me")
      .then(({ user }) => router.replace(HOME_FOR[user.role]))
      .catch(() => undefined);
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-12">
      <Logo />
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Share a seat. Split the fare.
          <br />
          <span className="text-brand">Survive Dhaka traffic.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Heading from Banani to Mohakhali while someone else heads to Gulshan 1? Share Jashim&apos;s three-seat
          Tesla, and each of you pays your own, smaller fare.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/login" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">
          Sign in
        </Link>
        <Link href="/signup" className="rounded-xl border border-line bg-white px-5 py-3 font-semibold hover:bg-surface">
          Create a passenger account
        </Link>
      </div>
      <ol className="grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["1. Request", "Pick your zone, destination and seats. See the price before you book."],
          ["2. Pool", "Going the same way as someone? You share a Tesla automatically."],
          ["3. Pay less", "Everyone pays their own fare, with 20% off when the ride is shared."],
        ].map(([title, body]) => (
          <li key={title} className="rounded-2xl border border-line bg-white p-4">
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-muted">{body}</div>
          </li>
        ))}
      </ol>
    </main>
  );
}
