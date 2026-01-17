import { apiGet, apiPost, apiPatch, logout } from "./api.js";
import { requireRole } from "./authGate.js";

const u = requireRole("vendor");
if (!u) throw new Error("Unauthorized");

document.getElementById("who").textContent = `Logged in as: ${u.email}`;

document.getElementById("logout").addEventListener("click", () => {
  logout();
  location.href = "./login.html";
});

const storeName = document.getElementById("storeName");
const region = document.getElementById("region");
const description = document.getElementById("description");
const profileCategory = document.getElementById("profileCategory"); // NEW
const applyBtn = document.getElementById("applyBtn");
const updateBtn = document.getElementById("updateBtn");
const profileMsg = document.getElementById("profileMsg");

const svcTitle = document.getElementById("svcTitle");
const svcCategory = document.getElementById("svcCategory");
const svcPrice = document.getElementById("svcPrice");
const svcDesc = document.getElementById("svcDesc");
const svcSlots = document.getElementById("svcSlots");
const addSvcBtn = document.getElementById("addSvcBtn");
const svcMsg = document.getElementById("svcMsg");
const svcList = document.getElementById("svcList");

const bookingsList = document.getElementById("bookingsList");

// Helper to show small status messages
function msg(el, t, ok = true) {
  el.textContent = t;
  el.style.color = ok ? "green" : "crimson";
}

// Enable/disable the whole services section
function setServicesEnabled(enabled) {
  const inputs = [svcTitle, svcCategory, svcPrice, svcDesc, svcSlots, addSvcBtn];
  inputs.forEach((x) => (x.disabled = !enabled));
  if (!enabled) {
    svcList.innerHTML = `<div class="meta">Create a profile first.</div>`;
  }
}

let currentProfile = null;

// NEW: load categories and fill both dropdowns (profile + services)
// Load categories and fill BOTH dropdowns (profile + services)
// IMPORTANT: the <option value> must be the *category key* (e.g. "hairdresser"),
// not the human title (e.g. "Hairdressers"). Otherwise the UI creates new categories.
async function loadCategories() {
  const empty = `<option value="">-- Select Category --</option>`;

  try {
    const cats = await apiGet("/categories");
    const arr = Array.isArray(cats) ? cats : [];

    const options =
      empty +
      arr
        .map((c) => {
          // Backend returns: { key, title, desc }
          if (c && typeof c === "object") {
            const key = String(c.key ?? "").trim();
            const label = String(c.title ?? c.key ?? "").trim();
            if (!key) return "";
            return `<option value="${key}">${label}</option>`;
          }

          // Fallback if backend returns strings
          if (typeof c === "string") {
            const key = c.trim();
            if (!key) return "";
            return `<option value="${key}">${key}</option>`;
          }

          return "";
        })
        .filter(Boolean)
        .join("");

    profileCategory.innerHTML = options || empty;
    svcCategory.innerHTML = options || empty;
  } catch {
    profileCategory.innerHTML = empty;
    svcCategory.innerHTML = empty;
  }
}

async function loadProfile() {
  try {
    const p = await apiGet("/vendor/me");
    currentProfile = p;

    // Fill inputs
    storeName.value = p.storeName || "";
    region.value = p.region || "";
    description.value = p.description || "";
    profileCategory.value = p.category || ""; // NEW

    // UX logic
    if (p.status === "approved") {
      msg(profileMsg, "Status: approved ✅", true);
      applyBtn.style.display = "none";     // existing vendor doesn't need "apply"
      updateBtn.style.display = "inline-block";
      setServicesEnabled(true);
    } else if (p.status === "pending") {
      msg(profileMsg, "Status: pending approval ⏳ (admin must approve)", true);
      applyBtn.style.display = "none";     // already applied
      updateBtn.style.display = "inline-block";
      setServicesEnabled(false);           // realistic: don't allow services until approved
    } else if (p.status === "rejected") {
      msg(profileMsg, "Status: rejected ❌ (update info then re-apply)", false);
      applyBtn.style.display = "inline-block"; // allow re-apply
      updateBtn.style.display = "inline-block";
      setServicesEnabled(false);
    } else {
      msg(profileMsg, `Status: ${p.status}`, true);
      applyBtn.style.display = "inline-block";
      updateBtn.style.display = "inline-block";
      setServicesEnabled(false);
    }

    return p;
  } catch (e) {
    // No profile exists yet
    currentProfile = null;
    msg(profileMsg, "No profile yet — please Apply/Create Profile first.", false);

    storeName.value = "";
    region.value = "";
    description.value = "";
    profileCategory.value = ""; // NEW

    applyBtn.style.display = "inline-block";
    updateBtn.style.display = "none";
    setServicesEnabled(false);

    return null;
  }
}

applyBtn.addEventListener("click", async () => {
  try {
    if (!profileCategory.value) {
      msg(profileMsg, "Please select a category before applying.", false);
      return;
    }

    const p = await apiPost("/vendor/apply", {
      storeName: storeName.value,
      region: region.value,
      category: profileCategory.value, // NEW
      description: description.value,
    });

    msg(profileMsg, `Applied. Status: ${p.status}`, true);
    await loadProfile();
  } catch (e) {
    msg(profileMsg, e.message, false);
  }
});

updateBtn.addEventListener("click", async () => {
  try {
    // If profile exists, allow updating category too
    const p = await apiPatch("/vendor/me", {
      storeName: storeName.value,
      region: region.value,
      category: profileCategory.value, // NEW
      description: description.value,
    });
    msg(profileMsg, `Updated. Status: ${p.status}`, true);
    await loadProfile();
  } catch (e) {
    msg(profileMsg, e.message, false);
  }
});

async function loadServices() {
  try {
    const services = await apiGet("/vendor/services");
    svcList.innerHTML = services.length
      ? services
          .map(
            (s) => `
        <div class="item">
          <div style="font-weight:800">${s.title}</div>
          <div class="meta">${s.category} • ${s.price} TND</div>
          <div class="meta">${(s.timeSlots || []).join(", ")}</div>
        </div>
      `
          )
          .join("")
      : `<div class="meta">No services yet.</div>`;
  } catch (e) {
    svcList.innerHTML = `<div class="meta">Error: ${e.message}</div>`;
  }
}

addSvcBtn.addEventListener("click", async () => {
  try {
    // Accept comma OR whitespace-separated slots
    const slots = (svcSlots.value || "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Default service category to profile category if user didn’t choose
    const cat =
      (svcCategory.value && svcCategory.value.trim()) ||
      (profileCategory.value && profileCategory.value.trim()) ||
      "";

    if (!cat) {
      msg(svcMsg, "Please select a category for the service.", false);
      return;
    }

    await apiPost("/vendor/services", {
      title: svcTitle.value,
      category: cat,
      price: Number(svcPrice.value) || 0,
      description: svcDesc.value,
      timeSlots: slots,
    });

    msg(svcMsg, "Service added ✅", true);
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

    const requested = bks.filter(b => b.status === "requested");
    const accepted = bks.filter(b => b.status === "accepted" || b.status === "confirmed");
    const completed = bks.filter(b => b.status === "completed");
    const declined = bks.filter(b => b.status === "declined");
    const cancelled = bks.filter(b => b.status === "cancelled");

    function renderSection(title, arr, renderer) {
      if (!arr.length) return "";
      return `
        <div style="margin:18px 0 10px;">
          <h4 style="margin:0 0 10px;">${title} (${arr.length})</h4>
          <div style="display:grid;gap:10px;">
            ${arr.map(renderer).join("")}
          </div>
        </div>
      `;
    }

    function baseCard(b) {
      const who = b.clientEmail ? b.clientEmail : (b.clientId ? `Client: ${b.clientId}` : "Client: Unknown");
      return `
        <div class="item">
          <div class="row" style="justify-content:space-between;">
            <span class="badge">${b.status}</span>
            <span class="meta">${b.date} ${b.timeSlot ? "• " + b.timeSlot : ""}</span>
          </div>
          <div class="meta"><strong>Booked by:</strong> ${who}</div>
          <div class="meta"><strong>Type:</strong> ${b.type || "appointment"}</div>
        </div>
      `;
    }

    function actions(b, buttonsHtml) {
      return `
        <div class="item">
          <div class="row" style="justify-content:space-between;">
            <span class="badge">${b.status}</span>
            <span class="meta">${b.date} ${b.timeSlot ? "• " + b.timeSlot : ""}</span>
          </div>
          <div class="meta"><strong>Booked by:</strong> ${b.clientEmail || b.clientId || "Unknown"}</div>
          <div class="meta"><strong>Type:</strong> ${b.type || "appointment"}</div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            ${buttonsHtml}
          </div>
        </div>
      `;
    }

    bookingsList.innerHTML =
      (bks.length === 0)
        ? `<div class="meta">No bookings yet.</div>`
        : `
          ${renderSection("Requested", requested, (b) =>
            actions(b, `
              <button class="btn" data-id="${b.id}" data-status="accepted">Accept</button>
              <button class="btn" data-id="${b.id}" data-status="declined">Decline</button>
            `)
          )}

          ${renderSection("Accepted / Upcoming", accepted, (b) =>
            actions(b, `
              <button class="btn" data-id="${b.id}" data-status="completed">Mark completed</button>
              <button class="btn" data-id="${b.id}" data-status="declined">Decline</button>
            `)
          )}

          ${renderSection("Completed", completed, (b) => baseCard(b))}
          ${renderSection("Declined", declined, (b) => baseCard(b))}
          ${renderSection("Cancelled", cancelled, (b) => baseCard(b))}
        `;

    // bind actions
    document.querySelectorAll("button[data-status]").forEach((btn) => {
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

// Init: load categories first (so dropdowns are ready), then profile
await loadCategories();
await loadProfile();

if (currentProfile && currentProfile.status === "approved") {
  await loadServices();
  await loadVendorBookings();
} else {
  bookingsList.innerHTML = `<div class="meta">Bookings will appear after approval.</div>`;
}
