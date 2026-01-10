import { apiGet, apiPost } from "./api.js";

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
  msgEl.style.color =
    type === "ok" ? "green" : type === "err" ? "crimson" : "";
}

function saveMsg(text, type) {
  sessionStorage.setItem(
    "lastBookingMsg",
    JSON.stringify({ text, type, ts: Date.now() })
  );
}

function restoreMsg() {
  const raw = sessionStorage.getItem("lastBookingMsg");
  if (!raw) return;
  try {
    const { text, type, ts } = JSON.parse(raw);
    // keep it for 30 seconds
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
  slotEl.innerHTML = timeSlots
    .map((t) => `<option value="${t}">${t}</option>`)
    .join("");
  vendorHasSlots = true;
  btnEl.disabled = false;
}

async function loadVendor() {
  if (!id) throw new Error("Missing vendor id in URL.");

  // ✅ use retry here
  vendor = await apiGetRetry(`/vendors/${id}`, 1, 700);

  nameEl.textContent = vendor.name;
  metaEl.textContent = `${vendor.region} • ${vendor.category}`;
  catEl.textContent = vendor.category;
  priceEl.textContent = `${vendor.price} TND`;
  descEl.textContent = vendor.description || "";

  // Display extra vendor info fields dynamically
  const fieldsToExclude = [
    "id",
    "name",
    "category",
    "region",
    "price",
    "description",
    "timeSlots",
  ];
  const infoLines = [];

  const formatKey = (k) =>
    k
      .replace(/([A-Z])/g, " $1")
      .trim()
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  for (const [key, value] of Object.entries(vendor)) {
    if (fieldsToExclude.includes(key) || value === null || value === undefined || value === "")
      continue;

    if (Array.isArray(value)) {
      if (!value.length) continue;
      infoLines.push(
        `<div><strong>${formatKey(key)}:</strong> ${value.join(", ")}</div>`
      );
    } else if (typeof value === "object") {
      continue;
    } else {
      infoLines.push(`<div><strong>${formatKey(key)}:</strong> ${value}</div>`);
    }
  }

  infoEl.innerHTML = infoLines.length > 0 ? infoLines.join("") : "";

  fillSlots(vendor.timeSlots || []);
}

btnEl.addEventListener("click", async (e) => {
  e.preventDefault();

  const date = dateEl.value;
  const timeSlot = slotEl.value;

  if (!date) {
    setMsg("Please select a date.", "err");
    return;
  }
  if (vendorHasSlots && !timeSlot) {
    setMsg("Please select a time slot.", "err");
    return;
  }

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

    // Optional: refresh vendor after booking (with retry) if you need it:
    // vendor = await apiGetRetry(`/vendors/${id}`, 1, 700);

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
