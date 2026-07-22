"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthField,
  AuthPrimaryButton,
  AuthShell,
} from "@/components/auth/AuthShell";
import { requestPasswordReset } from "@/lib/authSession";
import { useApp } from "@/lib/store";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { pushToast } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      pushToast("Reset OTP ready");
      const q = new URLSearchParams({
        email: res.email,
        mode: "reset",
      });
      if (res.demoCode) q.set("demo", res.demoCode);
      router.push(`/reset-password?${q.toString()}`);
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We’ll issue a short-lived OTP to reset your password."
      footer={
        <Link href="/login" className="font-bold text-coral">
          Back to sign in
        </Link>
      }
    >
      <AuthField
        label="Account email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        placeholder="you@email.com"
      />
      <AuthPrimaryButton loading={loading} onClick={() => void submit()}>
        Send reset OTP
      </AuthPrimaryButton>
    </AuthShell>
  );
}
