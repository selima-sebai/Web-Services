import { apiGet, apiPost, getUser, getToken } from "./api.js";

// Debug (optional)
console.log("USER:", getUser());
console.log("TOKEN exists?", !!getToken(), "len:", (getToken() || "").length);

// If logged in as vendor/admin, force dashboard-only experience
const u = getUser();
if (u?.role === "vendor") location.href = "./vendor-dashboard.html";
if (u?.role === "admin") location.href = "./admin.html";

async function apiGetRetry(path, retries = 1, delayMs = 600) {
  try {
    return await apiGet(path);
  } catch (e) {
    if (retries <= 0) throw e;
    await new Promise((r) => setTimeout(r, delayMs));
    return apiGetRetry(path, retries - 1, delayMs);
  }
}

const params = new URLSearchParams(location.search);
const id = params.get("id");

const nameEl = document.getElementById("vendorName");
const metaEl = document.getElementById("vendorMeta");
const catEl = document.getElementById("vendorCategory");
const priceEl = document.getElementById("vendorPrice");
const descEl = document.getElementById("vendorDesc");
const infoEl = document.getElementById("vendorInfo");

const dateEl = document.getElementById("date");
const slotEl = document.getElementById("timeSlot");
const msgEl = document.getElementById("msg");
const btnEl = document.getElementById("bookBtn");

let vendor = null;
let vendorHasSlots = false;

function setMsg(text, type = "info") {
  msgEl.textContent = text;
  msgEl.style.color = type === "ok" ? "green" : type === "err" ? "crimson" : "";
}

function saveMsg(text, type) {
  sessionStorage.setItem("lastBookingMsg", JSON.stringify({ text, type, ts: Date.now() }));
}

function restoreMsg() {
  const raw = sessionStorage.getItem("lastBookingMsg");
  if (!raw) return;
  try {
    const { text, type, ts } = JSON.parse(raw);
    if (Date.now() - ts < 30000) setMsg(text, type);
    else sessionStorage.removeItem("lastBookingMsg");
  } catch {
    sessionStorage.removeItem("lastBookingMsg");
  }
}

function fillSlots(timeSlots = []) {
  if (!timeSlots.length) {
    slotEl.innerHTML = `<option value="">No slots available</option>`;
    slotEl.disabled = true;
    vendorHasSlots = false;
    btnEl.disabled = false;
    return;
  }

  slotEl.disabled = false;
  slotEl.innerHTML = timeSlots.map((t) => `<option value="${t}">${t}</option>`).join("");
  vendorHasSlots = true;
  btnEl.disabled = false;
}

/**
 * Render ONLY public, human-friendly "extra info".
 * This prevents internal fields (ownerId, vendorProfileId, listingType, etc.)
 * from showing in the UI.
 */
function renderPublicExtraInfo(v) {
  const lines = [];

  if (v.specialties) {
    const s = Array.isArray(v.specialties) ? v.specialties.join(", ") : String(v.specialties);
    lines.push(`<div><strong>Specialties:</strong> ${s}</div>`);
  }

  if (typeof v.homeService === "boolean") {
    lines.push(`<div><strong>Home service:</strong> ${v.homeService ? "Yes" : "No"}</div>`);
  }

  if (v.durationMinutes) {
    lines.push(`<div><strong>Duration:</strong> ${v.durationMinutes} min</div>`);
  }

  return lines.join("");
}

async function loadVendor() {
  if (!id) throw new Error("Missing vendor id in URL.");

  vendor = await apiGetRetry(`/vendors/${id}`, 1, 700);

  nameEl.textContent = vendor.name || "Vendor";
  metaEl.textContent = `${vendor.region || ""} • ${vendor.category || ""}`;
  catEl.textContent = vendor.category || "";
  priceEl.textContent = `${vendor.price ?? ""} TND`;
  descEl.textContent = vendor.description || "";

  infoEl.innerHTML = renderPublicExtraInfo(vendor);

  fillSlots(vendor.timeSlots || []);
}

btnEl.addEventListener("click", async (e) => {
  e.preventDefault();

  const date = dateEl.value;
  const timeSlot = slotEl.value;

  if (!date) return setMsg("Please select a date.", "err");
  if (vendorHasSlots && !timeSlot) return setMsg("Please select a time slot.", "err");

  btnEl.disabled = true;
  setMsg("Booking…");

  try {
    const created = await apiPost("/bookings", {
      vendorId: vendor.id,
      date,
      timeSlot: vendorHasSlots ? timeSlot : null,
      type: vendor.category,
    });

    const text = `✅ Booking confirmed (ID: ${created.id}).`;
    setMsg(text, "ok");
    saveMsg(text, "ok");
    btnEl.disabled = true;
  } catch (err) {
    const text = `❌ ${err.message}`;
    setMsg(text, "err");
    saveMsg(text, "err");
    btnEl.disabled = false;
  }
});

restoreMsg();
loadVendor().catch((err) => {
  nameEl.textContent = "Vendor not found";
  setMsg(err.message, "err");
  btnEl.disabled = true;
});
