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
  if (u.role !== role) {
    // send them to correct dashboard
    if (u.role === "vendor") location.href = "./vendor-dashboard.html";
    else if (u.role === "admin") location.href = "./admin.html";
    else location.href = "./client-dashboard.html";
    return null;
  }
  return u;
}
