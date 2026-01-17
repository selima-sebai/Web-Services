import { getToken, getUser } from "./api.js";

export function requireLogin() {
  const token = getToken();
  if (!token) {
    location.href = "./login.html";
    return null;
  }
  return getUser();
}

export function requireRole(role) {
  const u = requireLogin();
  if (!u) return null;

  // ✅ Treat "user" as "client" (same actor)
  const effectiveRole = u.role === "user" ? "client" : u.role;

  if (effectiveRole !== role) {
    if (effectiveRole === "vendor") location.href = "./vendor-dashboard.html";
    else if (effectiveRole === "admin") location.href = "./admin.html";
    else location.href = "./client-dashboard.html";
    return null;
  }

  // optional: keep u.role as-is, or normalize it:
  // u.role = effectiveRole;

  return u;
}

