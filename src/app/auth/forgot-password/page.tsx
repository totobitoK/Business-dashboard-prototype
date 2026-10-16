"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/update-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setMessage("If that email exists, a reset link was sent.");
    } catch {
      setError("Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reset password</h1>
        <p className="mt-1 text-sm text-ink-muted">
          We will email a link to set a new password.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-ink">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-purple px-4 py-2 text-sm font-medium text-white"
        >
          Send reset link
        </button>
      </form>
      <Link href="/login" className="text-sm text-purple hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
