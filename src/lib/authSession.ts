/**
 * Client auth session for Zuko Android user app.
 * Production: swap issue/verify with CoinCall JWT `/auth/*`.
 * Never trusts client for wallet minting — only identity headers + UX gate.
 */

const SESSION_KEY = "zuko_user_session_v1";
const USERS_KEY = "zuko_local_users_v1";
const OTP_KEY = "zuko_otp_pending_v1";
const BOUND_KEY = "zuko_bound_user_id_v1";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt: number;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  expiresAt: number;
  /** JWT-shaped placeholder until server issues real JWT */
  refreshToken: string;
};

type StoredUser = AuthUser & { passwordHash: string };

function hashPassword(password: string): string {
  // Lightweight client hash (not a substitute for server bcrypt).
  let h = 2166136261;
  const s = `zuko:${password}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (!s?.token || !s.user?.email) return null;
    if (s.expiresAt && s.expiresAt < Date.now()) {
      // Soft refresh window: re-issue if refresh token still present
      if (s.refreshToken && s.expiresAt > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        return issueSession(s.user, s.refreshToken);
      }
      clearSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

/** Bind authenticated account to device wallet identity for API headers. */
export function bindSessionToDevice(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOUND_KEY, userId);
}

export function getBoundAuthUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BOUND_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const session = getSession();
  const headers: Record<string, string> = {};
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
    headers["X-Auth-User-Id"] = session.user.id;
    headers["X-Auth-Email"] = session.user.email;
  }
  return headers;
}

function issueSession(user: AuthUser, existingRefresh?: string): AuthSession {
  const refresh =
    existingRefresh ||
    `rt_${user.id}_${Math.random().toString(36).slice(2, 12)}`;
  const payload = encodeURIComponent(
    JSON.stringify({ sub: user.id, email: user.email, iat: Date.now() }),
  );
  const session: AuthSession = {
    token: `jwt.${payload}.zuko`,
    refreshToken: refresh,
    user,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  bindSessionToDevice(user.id);
  return session;
}

function makeOtpCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export type OtpPurpose = "register" | "login" | "reset";

export async function startOtp(input: {
  email: string;
  purpose: OtpPurpose;
  name?: string;
  password?: string;
}): Promise<{ demoCode?: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email");
  }
  const code = makeOtpCode();
  const payload = {
    email,
    purpose: input.purpose,
    codeHash: hashPassword(code),
    name: input.name?.trim() || "",
    passwordHash: input.password ? hashPassword(input.password) : "",
    at: Date.now(),
  };
  sessionStorage.setItem(OTP_KEY, JSON.stringify(payload));
  // Demo builds surface the code; production must email/SMS via API only.
  const isProd = process.env.NODE_ENV === "production";
  return { email, demoCode: isProd ? undefined : code };
}

export async function verifyOtp(input: {
  email: string;
  code: string;
}): Promise<AuthSession> {
  const raw = sessionStorage.getItem(OTP_KEY);
  if (!raw) throw new Error("Request a verification code first");
  const pending = JSON.parse(raw) as {
    email: string;
    purpose: OtpPurpose;
    codeHash: string;
    name: string;
    passwordHash: string;
    at: number;
  };
  if (pending.email !== input.email.trim().toLowerCase()) {
    throw new Error("Email mismatch");
  }
  if (Date.now() - pending.at > 10 * 60 * 1000) {
    throw new Error("Code expired — request a new one");
  }
  if (pending.codeHash !== hashPassword(input.code.trim())) {
    throw new Error("Invalid verification code");
  }

  const users = readUsers();
  let user = users.find((u) => u.email === pending.email);

  if (pending.purpose === "register") {
    if (user) throw new Error("Email already registered");
    if (!pending.passwordHash) throw new Error("Registration incomplete");
    user = {
      id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      email: pending.email,
      name: pending.name || "Zuko Fan",
      createdAt: Date.now(),
      passwordHash: pending.passwordHash,
    };
    writeUsers([user, ...users]);
  } else if (pending.purpose === "login") {
    if (!user) throw new Error("Account not found");
  } else if (pending.purpose === "reset") {
    if (!user) throw new Error("Account not found");
    if (!pending.passwordHash) throw new Error("Set a new password first");
    const idx = users.findIndex((u) => u.email === pending.email);
    users[idx] = { ...users[idx]!, passwordHash: pending.passwordHash };
    writeUsers(users);
    user = users[idx]!;
  }

  sessionStorage.removeItem(OTP_KEY);
  return issueSession({
    id: user!.id,
    email: user!.email,
    name: user!.name,
    createdAt: user!.createdAt,
  });
}

export async function registerAccount(input: {
  email: string;
  password: string;
  name: string;
}): Promise<{ email: string; demoCode?: string }> {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error("Email already registered");
  }
  return startOtp({
    email,
    purpose: "register",
    name: input.name,
    password: input.password,
  });
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<{ email: string; demoCode?: string }> {
  const email = input.email.trim().toLowerCase();
  const users = readUsers();
  const hit = users.find((u) => u.email === email);
  if (!hit || hit.passwordHash !== hashPassword(input.password)) {
    throw new Error("Invalid email or password");
  }
  return startOtp({ email, purpose: "login" });
}

export async function requestPasswordReset(email: string): Promise<{
  email: string;
  demoCode?: string;
}> {
  const e = email.trim().toLowerCase();
  const users = readUsers();
  const hit = users.find((u) => u.email === e);
  if (!hit) throw new Error("No account with that email");
  return startOtp({ email: e, purpose: "reset" });
}

export async function setPendingResetPassword(newPassword: string) {
  const raw = sessionStorage.getItem(OTP_KEY);
  if (!raw) throw new Error("Request a reset code first");
  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  const pending = JSON.parse(raw) as Record<string, unknown>;
  if (pending.purpose !== "reset") throw new Error("Invalid reset session");
  pending.passwordHash = hashPassword(newPassword);
  sessionStorage.setItem(OTP_KEY, JSON.stringify(pending));
}

/** @deprecated use verifyOtp after setPendingResetPassword */
export async function resetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<AuthSession> {
  await setPendingResetPassword(input.newPassword);
  return verifyOtp({ email: input.email, code: input.code });
}

export function logoutAccount() {
  clearSession();
  if (typeof window !== "undefined") {
    localStorage.removeItem(BOUND_KEY);
  }
}

export function refreshSessionIfNeeded(): AuthSession | null {
  return getSession();
}
