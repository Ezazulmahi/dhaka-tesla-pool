"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, toApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { HOME_FOR } from "@/hooks/useSession";
import { Logo } from "@/components/AppHeader";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";

// The story cast from the seed data. Shown so evaluators can switch roles in one click.
const DEMO_ACCOUNTS = [
  { name: "Nusrat", phone: "01811000001", note: "Passenger · ৳500 TeslaPay" },
  { name: "Rafiq", phone: "01811000002", note: "Passenger · pays cash" },
  { name: "Shirin", phone: "01811000003", note: "Passenger · ৳300 TeslaPay" },
  { name: "Jashim", phone: "01711000001", note: "Driver · Bullet (3 seats), Banani" },
  { name: "Kamal", phone: "01711000002", note: "Driver · Toofan (3 seats), offline" },
];
const DEMO_PASSWORD = "bullet123";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(p: string, pw: string) {
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await api<{ user: User }>("/auth/login", { body: { phone: p, password: pw } });
      router.replace(HOME_FOR[user.role]);
    } catch (e) {
      setError(toApiError(e).message);
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void signIn(phone.trim(), password);
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 items-center gap-8 px-4 py-10 md:grid-cols-2">
      <div className="space-y-6">
        <Logo />
        <Card>
          <h1 className="text-xl font-bold">Sign in</h1>
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <Field label="Mobile number">
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="username"
                placeholder="01811000001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && <ErrorBanner message={error} />}
            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            New passenger?{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </div>

      <Card className="bg-white/70">
        <h2 className="font-semibold">Demo accounts</h2>
        <p className="mt-1 text-sm text-muted">
          Everyone&apos;s password is <code className="rounded bg-surface px-1.5 py-0.5 font-mono">{DEMO_PASSWORD}</code>.
          Tip: open the driver in a second browser (or a private window) to watch both sides.
        </p>
        <ul className="mt-4 divide-y divide-line">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.phone} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted">
                  {a.phone} · {a.note}
                </div>
              </div>
              <Button variant="secondary" disabled={submitting} onClick={() => void signIn(a.phone, DEMO_PASSWORD)}>
                Sign in
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
