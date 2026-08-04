"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthField,
  AuthPrimaryButton,
  AuthShell,
} from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { loginWithGoogle, loginWithPassword } from "@/lib/authSession";
import { useApp } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const { pushToast } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);

  const submit = async () => {
    setLoading("email");
    try {
      await loginWithPassword({ email, password });
      pushToast("Welcome back");
      router.push("/");
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(null);
    }
  };

  const googleSignIn = async () => {
    setLoading("google");
    try {
      await loginWithGoogle();
      pushToast("Welcome back");
      router.push("/");
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Secure login for your Zuko wallet, calls, and VIP."
      footer={
        <div className="space-y-2">
          <p>
            New here?{" "}
            <Link href="/register" className="font-bold text-coral">
              Create an account
            </Link>
          </p>
          <Link href="/forgot-password" className="font-bold text-coral">
            Forgot password?
          </Link>
        </div>
      }
    >
      <GoogleSignInButton
        disabled={loading !== null}
        busy={loading === "google"}
        onClick={() => void googleSignIn()}
      />
      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          or use email
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        placeholder="you@email.com"
      />
      <AuthField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
      />
      <AuthPrimaryButton
        loading={loading === "email"}
        disabled={loading !== null}
        onClick={() => void submit()}
      >
        Sign in with email
      </AuthPrimaryButton>
    </AuthShell>
  );
}
