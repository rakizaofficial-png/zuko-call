/**
 * Smoke-test welcome push rotation uniqueness (no browser).
 * Run: npx tsx src/lib/welcomePush/rotation.smoke.ts
 */

import { DEMO_HOST_POOL } from "./demoHosts";
import { NOTIFICATION_TEMPLATES } from "./templates";
import { WELCOME_PUSH_CONFIG } from "./config";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  assert(DEMO_HOST_POOL.length >= 20, "Need ≥20 demo hosts");
  assert(NOTIFICATION_TEMPLATES.length >= 30, "Need ≥30 message templates");

  const hostIds = new Set(DEMO_HOST_POOL.map((h) => h.id));
  assert(hostIds.size === DEMO_HOST_POOL.length, "Duplicate demo host ids");

  const msgIds = new Set(NOTIFICATION_TEMPLATES.map((m) => m.id));
  assert(msgIds.size === NOTIFICATION_TEMPLATES.length, "Duplicate message ids");

  const names = DEMO_HOST_POOL.map((h) => h.name);
  assert(new Set(names).size >= 18, "Too few unique names");

  const avatars = DEMO_HOST_POOL.map((h) => h.avatarSeed);
  assert(new Set(avatars).size === DEMO_HOST_POOL.length, "Duplicate avatar seeds");

  // Simulate cooldown: last N hosts should not be re-picked while fresh remain
  const cooldown = WELCOME_PUSH_CONFIG.hostCooldownCount;
  const recent = DEMO_HOST_POOL.slice(0, cooldown).map((h) => h.id);
  const cool = new Set(recent);
  const fresh = DEMO_HOST_POOL.filter((h) => !cool.has(h.id));
  assert(fresh.length > 0, "Cooldown exhausted entire pool — increase pool size");

  const msgCool = WELCOME_PUSH_CONFIG.messageCooldownCount;
  const recentMsg = NOTIFICATION_TEMPLATES.slice(0, msgCool).map((m) => m.id);
  const coolMsg = new Set(recentMsg);
  const freshMsg = NOTIFICATION_TEMPLATES.filter((m) => !coolMsg.has(m.id));
  assert(freshMsg.length > 0, "Message cooldown exhausted pool");

  // Timing ranges must be sensible
  assert(
    WELCOME_PUSH_CONFIG.launchDelayMinMs === 7_000 &&
      WELCOME_PUSH_CONFIG.launchDelayMaxMs === 7_000,
    "First preview must trigger after 7 seconds",
  );
  assert(
    WELCOME_PUSH_CONFIG.repeatEveryMinMs === 60_000 &&
      WELCOME_PUSH_CONFIG.repeatEveryMaxMs === 60_000,
    "Recurring previews must use a 60 second interval",
  );
  assert(
    WELCOME_PUSH_CONFIG.lowCoinThreshold === 80,
    "Low-coin autocall threshold should be 80",
  );
  assert(
    WELCOME_PUSH_CONFIG.postRechargeDelayMinMs === 60_000 &&
      WELCOME_PUSH_CONFIG.postRechargeDelayMaxMs === 60_000,
    "Fallback repeat interval must be 60 seconds",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        demoHosts: DEMO_HOST_POOL.length,
        messages: NOTIFICATION_TEMPLATES.length,
        hostCooldown: cooldown,
        messageCooldown: msgCool,
        freshHostsAfterCooldown: fresh.length,
        freshMessagesAfterCooldown: freshMsg.length,
      },
      null,
      2,
    ),
  );
}

main();
