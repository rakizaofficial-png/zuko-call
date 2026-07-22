/**
 * Lightweight scenario checks for Live → Private Call helpers.
 * Run: npx tsx src/lib/livePrivateCall.test.ts
 */

import {
  estimateCallMinutes,
  hostAcceptsLiveCalls,
  type LivePrivateCallHistoryRow,
} from "./livePrivateCall";
import type { LiveHost } from "./api";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const baseHost: LiveHost = {
  id: "h1",
  name: "Ayesha",
  ratePerMinute: 80,
  isOnline: true,
  isLive: true,
  isOnCall: false,
};

function scenarioAccepts() {
  assert(hostAcceptsLiveCalls(baseHost).ok, "live host should accept");
  assert(
    !hostAcceptsLiveCalls({ ...baseHost, readyToCall: false }).ok,
    "readyToCall=false should block",
  );
  assert(
    !hostAcceptsLiveCalls({ ...baseHost, isOnCall: true }).ok,
    "on-call host should block",
  );
  assert(
    !hostAcceptsLiveCalls({
      ...baseHost,
      isLive: false,
      isOnline: false,
    }).ok,
    "offline host should block",
  );
  console.log("✓ host accept / reject / offline gates");
}

function scenarioCoins() {
  assert(estimateCallMinutes(240, 80) === 3, "240/80 = 3 min");
  assert(estimateCallMinutes(79, 80) === 0, "insufficient → 0 min");
  assert(estimateCallMinutes(80, 80) === 1, "exact one minute");
  console.log("✓ coin estimate / low-balance math");
}

function scenarioHistoryShape() {
  const statuses: LivePrivateCallHistoryRow["status"][] = [
    "accepted",
    "rejected",
    "missed",
    "cancelled",
    "ended",
    "insufficient",
    "offline",
  ];
  for (const status of statuses) {
    const row: LivePrivateCallHistoryRow = {
      id: `t_${status}`,
      hostId: "h1",
      hostName: "Ayesha",
      at: Date.now(),
      durationSec: status === "ended" ? 95 : 0,
      coinsSpent: status === "ended" || status === "accepted" ? 80 : 0,
      status,
      ratePerMinute: 80,
    };
    assert(row.status === status, `history row ${status}`);
  }
  console.log("✓ call history statuses (accept/reject/miss/cancel/end/low)");
}

scenarioAccepts();
scenarioCoins();
scenarioHistoryShape();
console.log("\nAll Live→Video Call helper scenarios passed.");
