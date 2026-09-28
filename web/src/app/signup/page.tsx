"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, toApiError } from "@/lib/api";
import { Logo } from "@/components/AppHeader";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api("/auth/signup", { body: { ...form, phone: form.phone.trim() } });
      router.replace("/passenger");
    } catch (err) {
      const apiErr = toApiError(err);
      const fields = apiErr.fieldErrors();
      if (Object.keys(fields).length) setFieldErrors(fields);
      else setError(apiErr.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-10">
      <Logo />
      <Card>
        <h1 className="text-xl font-bold">Create a passenger account</h1>
        <p className="mt-1 text-sm text-muted">Drivers are onboarded by the Tesla Pool team after vehicle checks.</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <Field label="Name" error={fieldErrors.name}>
            <input className={inputClass} autoComplete="name" value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Mobile number" error={fieldErrors.phone}>
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              value={form.phone}
              onChange={set("phone")}
              required
            />
          </Field>
          <Field label="Password (8+ characters)" error={fieldErrors.password}>
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              required
            />
          </Field>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" loading={submitting} className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Already riding with us?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
