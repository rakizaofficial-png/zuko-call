"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AUTH_CHANGED_EVENT,
  getSession,
  validateStoredSession,
} from "@/lib/authSession";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/otp", "/reset-password"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function sessionSnapshot() {
  const session = getSession();
  return session ? `${session.user.id}:${session.token}` : "";
}

function subscribeAuth(onChange: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authState = useSyncExternalStore(subscribeAuth, sessionSnapshot, () => "");
  const publicPath = isPublicPath(pathname);
  const [validatedState, setValidatedState] = useState<string | null>(null);
  const valid = Boolean(authState) && validatedState === authState;

  useEffect(() => {
    let active = true;
    if (!authState) {
      if (!publicPath) router.replace("/login");
      return () => {
        active = false;
      };
    }

    void validateStoredSession().then((session) => {
      if (!active) return;
      if (!session) {
        setValidatedState(null);
        if (!publicPath) router.replace("/login");
        return;
      }
      setValidatedState(`${session.user.id}:${session.token}`);
      if (publicPath) router.replace("/");
    });

    return () => {
      active = false;
    };
  }, [authState, publicPath, router]);

  if ((authState && !valid) || (valid && publicPath) || (!authState && !publicPath)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-sm text-muted">Checking account…</span>
      </div>
    );
  }

  return <>{children}</>;
}
