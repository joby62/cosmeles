const ADMIN_PASSWORD_ENV_KEY = "ADMIN_CONSOLE_PASSWORD";
const ADMIN_SESSION_SALT_ENV_KEY = "ADMIN_CONSOLE_SESSION_SALT";
const ADMIN_TOKEN_NAMESPACE = "cosmeles-admin-session-v1";

export const ADMIN_CONSOLE_COOKIE_NAME = "mx_admin_console";
export const ADMIN_CONSOLE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const ADMIN_CONSOLE_DEFAULT_REDIRECT = "/product";

const ADMIN_PROTECTED_PATH_PATTERNS = [
  /^\/product(?:\/)?$/,
  /^\/product\/pipeline(?:\/|$)/,
  /^\/product\/governance(?:\/|$)/,
  /^\/product\/ingredients(?:\/|$)/,
  /^\/analytics(?:\/|$)/,
  /^\/matrix-test(?:\/|$)/,
  /^\/git(?:\/|$)/,
];

function readEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

function toHex(input: ArrayBuffer): string {
  const view = new Uint8Array(input);
  let out = "";
  for (const value of view) {
    out += value.toString(16).padStart(2, "0");
  }
  return out;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

export function getAdminConsolePassword(): string {
  return readEnv(ADMIN_PASSWORD_ENV_KEY);
}

export function isAdminConsoleConfigured(): boolean {
  return Boolean(getAdminConsolePassword());
}

export function isAdminProtectedPath(pathname: string): boolean {
  return ADMIN_PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function normalizeAdminReturnTo(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return ADMIN_CONSOLE_DEFAULT_REDIRECT;
  const pathname = raw.split("?")[0] || raw;
  return isAdminProtectedPath(pathname) ? raw : ADMIN_CONSOLE_DEFAULT_REDIRECT;
}

export async function buildAdminConsoleSessionToken(password: string): Promise<string> {
  const secretSalt = readEnv(ADMIN_SESSION_SALT_ENV_KEY) || "cosmeles-admin";
  return sha256(`${ADMIN_TOKEN_NAMESPACE}:${secretSalt}:${password}`);
}

export async function getConfiguredAdminConsoleSessionToken(): Promise<string> {
  const password = getAdminConsolePassword();
  if (!password) return "";
  return buildAdminConsoleSessionToken(password);
}

export async function isValidAdminConsoleSession(token: string | null | undefined): Promise<boolean> {
  const value = String(token || "").trim();
  if (!value) return false;
  const expected = await getConfiguredAdminConsoleSessionToken();
  if (!expected) return false;
  return value === expected;
}
