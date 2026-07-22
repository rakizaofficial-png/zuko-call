"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthField,
  AuthPrimaryButton,
  AuthShell,
} from "@/components/auth/AuthShell";
import { verifyOtp } from "@/lib/authSession";
import { useApp } from "@/lib/store";

function OtpForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { pushToast, updateDisplayName } = useApp();
  const [email, setEmail] = useState(search.get("email") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const demo = search.get("demo") || "";

  const submit = async () => {
    setLoading(true);
    try {
      const session = await verifyOtp({ email, code });
      await updateDisplayName(session.user.name);
      pushToast("Verified — secure session active");
      router.replace("/profile");
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Enter OTP"
      subtitle="Verify the 6-digit code sent to your email to complete secure login."
      footer={
        <Link href="/login" className="font-bold text-coral">
          Back to sign in
        </Link>
      }
    >
      <AuthField
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@email.com"
      />
      <AuthField
        label="One-time password"
        value={code}
        onChange={setCode}
        placeholder="6-digit code"
        autoComplete="one-time-code"
      />
      {demo ? (
        <p className="rounded-xl bg-gold/10 px-3 py-2 text-center text-xs text-gold">
          Dev OTP: <strong>{demo}</strong> (hidden in production builds)
        </p>
      ) : (
        <p className="text-center text-[11px] text-muted">
          Production sends OTP by email/SMS via CoinCall Auth API.
        </p>
      )}
      <AuthPrimaryButton loading={loading} onClick={() => void submit()}>
        Verify &amp; continue
      </AuthPrimaryButton>
    </AuthShell>
  );
}

export default function OtpPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-sm text-muted">
          Loading…
        </main>
      }
    >
      <OtpForm />
    </Suspense>
  );
}
