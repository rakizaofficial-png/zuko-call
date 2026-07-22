"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** User App is login-only — registration is disabled. */
export default function RegisterRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-muted">
      Redirecting to login…
    </main>
  );
}
