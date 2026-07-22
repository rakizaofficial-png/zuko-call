"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { restorePurchases } from "@/lib/payments/iap";
import { useApp } from "@/lib/store";

function PaymentResultInner() {
  const search = useSearchParams();
  const { syncWallet, pushToast, coins } = useApp();
  const status = (search.get("status") || "success").toLowerCase();
  const [restoring, setRestoring] = useState(false);
  const ok = status === "success" || status === "ok";
  const failed = status === "failed" || status === "fail" || status === "error";

  useEffect(() => {
    if (ok) void syncWallet();
  }, [ok, syncWallet]);

  const onRestore = async () => {
    setRestoring(true);
    try {
      const res = await restorePurchases();
      await syncWallet();
      pushToast(res.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <main className="safe-header flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-6 pb-16 text-center">
      {ok ? (
        <CheckCircle2 className="h-16 w-16 text-teal" />
      ) : (
        <XCircle className="h-16 w-16 text-coral" />
      )}
      <h1 className="mt-4 font-display text-2xl font-extrabold">
        {ok ? "Payment successful" : failed ? "Payment failed" : "Payment status"}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {ok
          ? `Coins credited to your wallet. Balance: ${coins.toLocaleString()}.`
          : "No coins were charged. You can retry checkout or restore a pending Play purchase."}
      </p>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
        <Link
          href="/profile"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-coral text-sm font-bold text-white"
        >
          {ok ? "Back to wallet" : "Try again"}
        </Link>
        <button
          type="button"
          disabled={restoring}
          onClick={() => void onRestore()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-ink-2/70 text-sm font-bold disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${restoring ? "animate-spin" : ""}`} />
          Restore purchases
        </button>
        <Link href="/" className="py-2 text-xs font-semibold text-cyan">
          Go home
        </Link>
      </div>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-sm text-muted">
          Loading…
        </main>
      }
    >
      <PaymentResultInner />
    </Suspense>
  );
}
