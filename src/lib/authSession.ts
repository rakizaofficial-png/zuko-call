/**
 * Server-backed auth session for the Zuko user app.
 * CoinCall owns account credentials, session tokens, wallet identity, and
 * Google ID-token verification. The browser stores only the issued session.
 */

import { apiConfig, requireApiBase } from "@/config/apiConfig";
import {
  getGoogleFirebaseIdToken,
  signOutFirebaseUser,
} from "@/lib/firebaseAuth";

const SESSION_KEY = "zuko_user_session_v1";
const USERS_KEY = "zuko_local_users_v1";
const OTP_KEY = "zuko_otp_pending_v1";
const BOUND_KEY = "zuko_bound_user_id_v1";
export const AUTH_CHANGED_EVENT = "zuko:auth-changed";

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
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
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
    headers["X-User-Id"] = session.user.id;
    headers["X-Auth-User-Id"] = session.user.id;
    headers["X-Auth-Email"] = session.user.email;
  }
  return headers;
}

function issueSession(
  user: AuthUser,
  existingRefresh?: string,
  accessToken?: string,
): AuthSession {
  const refresh =
    existingRefresh ||
    `rt_${user.id}_${Math.random().toString(36).slice(2, 12)}`;
  const payload = encodeURIComponent(
    JSON.stringify({ sub: user.id, email: user.email, iat: Date.now() }),
  );
  const session: AuthSession = {
    token: accessToken || `jwt.${payload}.zuko`,
    refreshToken: refresh,
    user,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  bindSessionToDevice(user.id);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  return session;
}

type AuthApiResponse = {
  token?: unknown;
  userId?: unknown;
  email?: unknown;
  displayName?: unknown;
};

async function readAuthResponse(response: Response): Promise<AuthSession> {
  const data = (await response.json().catch(() => ({}))) as AuthApiResponse & {
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Authentication failed (${response.status})`,
    );
  }
  const token = String(data.token || "");
  const userId = String(data.userId || "");
  const email = String(data.email || "");
  const name = String(data.displayName || email.split("@")[0] || "Zuko User");
  if (!token || !userId || !email) {
    throw new Error("Server returned an incomplete account session");
  }
  return issueSession(
    { id: userId, email, name, createdAt: Date.now() },
    undefined,
    token,
  );
}

export async function validateStoredSession(): Promise<AuthSession | null> {
  const current = getSession();
  if (!current) return null;
  try {
    const response = await fetch(`${requireApiBase()}/users/session`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      clearSession();
      return null;
    }
    const data = (await response.json()) as AuthApiResponse;
    const userId = String(data.userId || "");
    if (!userId || userId !== current.user.id) {
      clearSession();
      return null;
    }
    return current;
  } catch {
    // A network outage must not silently grant access with an unverified token.
    clearSession();
    return null;
  }
}

export async function loginWithGoogle(): Promise<AuthSession> {
  const idToken = await getGoogleFirebaseIdToken();
  const response = await fetch(`${requireApiBase()}/users/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return readAuthResponse(response);
}

function makeOtpCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export type OtpPurpose = "reset";

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

  if (pending.purpose === "reset") {
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
}): Promise<AuthSession> {
  return registerWithPassword(input);
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthSession> {
  const response = await fetch(`${requireApiBase()}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      displayName: input.name.trim(),
    }),
  });
  return readAuthResponse(response);
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return loginWithPassword(input);
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const response = await fetch(`${requireApiBase()}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
    }),
  });
  return readAuthResponse(response);
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
  const session = getSession();
  if (session) {
    void fetch(`${requireApiBase()}/users/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        "X-User-Id": session.user.id,
      },
      body: JSON.stringify({ userId: session.user.id }),
    }).catch(() => undefined);
  }
  void signOutFirebaseUser();
  clearSession();
  if (typeof window !== "undefined") {
    localStorage.removeItem(BOUND_KEY);
    localStorage.removeItem(apiConfig.deviceUserKey);
  }
}

export function refreshSessionIfNeeded(): AuthSession | null {
  return getSession();
}
