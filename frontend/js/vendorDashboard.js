import { apiGet, apiPost, apiPatch, logout } from "./api.js";
import { requireRole } from "./authGate.js";

const u = requireRole("vendor");
document.getElementById("who").textContent = u ? `Logged in as: ${u.email}` : "";

document.getElementById("logout").addEventListener("click", () => {
  logout();
  location.href = "./login.html";
});

const storeName = document.getElementById("storeName");
const region = document.getElementById("region");
const description = document.getElementById("description");
const applyBtn = document.getElementById("applyBtn");
const updateBtn = document.getElementById("updateBtn");
const profileMsg = document.getElementById("profileMsg");
const profileBox = document.getElementById("profileBox");

const svcTitle = document.getElementById("svcTitle");
const svcCategory = document.getElementById("svcCategory");
const svcPrice = document.getElementById("svcPrice");
const svcDesc = document.getElementById("svcDesc");
const svcSlots = document.getElementById("svcSlots");
const addSvcBtn = document.getElementById("addSvcBtn");
const svcMsg = document.getElementById("svcMsg");
const svcList = document.getElementById("svcList");

const bookingsList = document.getElementById("bookingsList");

function msg(el, t, ok = true) {
  el.textContent = t;
  el.style.color = ok ? "green" : "crimson";
}

async function loadProfile() {
  try {
    const p = await apiGet("/vendor/me");
    profileBox.textContent = JSON.stringify(p, null, 2);
    storeName.value = p.storeName || "";
    region.value = p.region || "";
    description.value = p.description || "";
    msg(profileMsg, `Status: ${p.status}`, true);
  } catch (e) {
    profileBox.textContent = "";
    msg(profileMsg, e.message, false);
  }
}

applyBtn.addEventListener("click", async () => {
  try {
    const p = await apiPost("/vendor/apply", {
      storeName: storeName.value,
      region: region.value,
      description: description.value,
    });
    profileBox.textContent = JSON.stringify(p, null, 2);
    msg(profileMsg, `Applied. Status: ${p.status}`, true);
  } catch (e) {
    msg(profileMsg, e.message, false);
  }
});

updateBtn.addEventListener("click", async () => {
  try {
    const p = await apiPatch("/vendor/me", {
      storeName: storeName.value,
      region: region.value,
      description: description.value,
    });
    profileBox.textContent = JSON.stringify(p, null, 2);
    msg(profileMsg, `Updated. Status: ${p.status}`, true);
  } catch (e) {
    msg(profileMsg, e.message, false);
  }
});

async function loadServices() {
  try {
    const services = await apiGet("/vendor/services");
    svcList.innerHTML = services.length
      ? services.map(s => `
        <div class="item">
          <div style="font-weight:800">${s.title}</div>
          <div class="meta">${s.category} • ${s.price} TND</div>
          <div class="meta">${(s.timeSlots||[]).join(", ")}</div>
        </div>
      `).join("")
      : `<div class="meta">No services yet.</div>`;
  } catch (e) {
    svcList.innerHTML = `<div class="meta">Error: ${e.message}</div>`;
  }
}

addSvcBtn.addEventListener("click", async () => {
  try {
    const slots = (svcSlots.value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    await apiPost("/vendor/services", {
      title: svcTitle.value,
      category: svcCategory.value,
      price: Number(svcPrice.value) || 0,
      description: svcDesc.value,
      timeSlots: slots,
    });

    msg(svcMsg, "Service added", true);
    svcTitle.value = "";
    svcCategory.value = "";
    svcPrice.value = "";
    svcDesc.value = "";
    svcSlots.value = "";
    await loadServices();
  } catch (e) {
    msg(svcMsg, e.message, false);
  }
});

async function loadVendorBookings() {
  try {
    const bks = await apiGet("/vendor/bookings");
    if (!bks.length) {
      bookingsList.innerHTML = `<div class="meta">No booking requests yet.</div>`;
      return;
    }
    bookingsList.innerHTML = bks.map(b => `
      <div class="item">
        <div class="row" style="justify-content:space-between;">
          <span class="badge">${b.status}</span>
          <span class="meta">${b.date} ${b.timeSlot ? "• "+b.timeSlot : ""}</span>
        </div>
        <div class="meta">Type: ${b.type}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn" data-id="${b.id}" data-status="accepted">Accept</button>
          <button class="btn" data-id="${b.id}" data-status="declined">Decline</button>
          <button class="btn" data-id="${b.id}" data-status="completed">Mark completed</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("button[data-status]").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await apiPatch(`/vendor/bookings/${btn.dataset.id}/status`, { status: btn.dataset.status });
          await loadVendorBookings();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    bookingsList.innerHTML = `<div class="meta">Error: ${e.message}</div>`;
  }
}

await loadProfile();
await loadServices();
await loadVendorBookings();
