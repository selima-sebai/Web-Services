import { apiPost, setSession } from "./api.js";

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg");

const loginBtn = document.getElementById("loginBtn");
const regClientBtn = document.getElementById("registerClientBtn");
const regVendorBtn = document.getElementById("registerVendorBtn");

function setMsg(text, type = "info") {
  msgEl.textContent = text;
  msgEl.style.color = type === "err" ? "crimson" : type === "ok" ? "green" : "";
}

function goDashboard(user) {
  if (user.role === "vendor") location.href = "./vendor-dashboard.html";
  else if (user.role === "admin") location.href = "./admin.html";
  else location.href = "./client-dashboard.html";
}

async function login() {
  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";
  if (!email || !password) return setMsg("Enter email and password", "err");

  loginBtn.disabled = true;
  try {
    const res = await apiPost("/auth/login", { email, password });
    setSession(res.token, res.user);
    setMsg("✅ Logged in", "ok");
    goDashboard(res.user);
  } catch (e) {
    setMsg(e.message, "err");
  } finally {
    loginBtn.disabled = false;
  }
}

async function register(role) {
  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";
  if (!email || !password) return setMsg("Enter email and password", "err");

  regClientBtn.disabled = true;
  regVendorBtn.disabled = true;

  try {
    const res = await apiPost("/auth/register", { email, password, role });
    setSession(res.token, res.user);
    setMsg("✅ Registered", "ok");
    goDashboard(res.user);
  } catch (e) {
    setMsg(e.message, "err");
  } finally {
    regClientBtn.disabled = false;
    regVendorBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", login);
regClientBtn.addEventListener("click", () => register("client"));
regVendorBtn.addEventListener("click", () => register("vendor"));

