const BACKEND_ORIGIN =
  location.origin === "null"
    ? "http://localhost:3000"
    : `${location.protocol}//${location.hostname}:3000`;

const TOKEN_KEY = "eersi_token";
const USER_KEY = "eersi_user";

export function setSession(token, user) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);

  if (!user) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function logout() {
  setSession("", null);
}

export function resolveUrl(src) {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return BACKEND_ORIGIN + src;
  const clean = src.replace(/^\.\//, "");
  return `${BACKEND_ORIGIN}/${clean}`;
}

async function request(path, options = {}) {
  const url = `${BACKEND_ORIGIN}/api${path}`;

  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    throw new Error(`Network error calling ${url}: ${e.message}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const msg =
      (payload && payload.error) ||
      (typeof payload === "string" && payload) ||
      res.statusText ||
      "Request failed";
    throw new Error(`API ${res.status}: ${msg}`);
  }

  return payload;
}

export function apiGet(path) { return request(path); }
export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
export function apiPut(path, body) {
  return request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
export function apiPatch(path, body) {
  return request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
export function apiDelete(path) { return request(path, { method: "DELETE" }); }
