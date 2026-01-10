import { apiGet, apiDelete, apiPost } from "./api.js";

const listEl = document.getElementById("bookingsList");
const statusFilter = document.getElementById("statusFilter");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refresh");

let vendorsMap = {};

async function loadVendorsMap() {
  try {
    const vendors = await apiGet("/vendors");
    vendorsMap = vendors.reduce((acc, v) => { acc[v.id] = v; return acc; }, {});
  } catch (err) {
    console.warn("Failed to load vendors", err);
    vendorsMap = {};
  }
}

function render(bookings) {
  const term = (searchEl?.value || "").trim().toLowerCase();
  const filterStatus = statusFilter?.value || "";

  const filtered = bookings.filter(b => {
    if (filterStatus && b.status !== filterStatus) return false;
    if (!term) return true;
    const vendor = vendorsMap[b.vendorId];
    return (vendor?.name || "").toLowerCase().includes(term)
      || (b.date || "").toLowerCase().includes(term)
      || (b.timeSlot || "").toLowerCase().includes(term)
      || (b.type || "").toLowerCase().includes(term);
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">No bookings found.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(b => {
    const v = vendorsMap[b.vendorId] || {};
    const statusBadge = b.status === "cancelled" ? `<span class="badge" style="background:rgba(0,0,0,.04);color:var(--muted)">Cancelled</span>` :
                         `<span class="badge">${b.status}</span>`;
    const cancelBtn = b.status !== "cancelled" ? `<button class="btn" data-id="${b.id}" data-action="cancel">Cancel</button>` : "";
    return `
      <div class="item">
        <div class="row" style="justify-content:space-between;">
          <div>
            ${statusBadge}
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;color:var(--blue)">${v.name || ("Vendor #" + b.vendorId)}</div>
            <div class="meta">${v.region || ""}</div>
          </div>
        </div>

        <h3 style="margin:10px 0 0 0;">${b.date} ${b.timeSlot ? "• " + b.timeSlot : ""}</h3>
        <div class="meta" style="margin-top:8px;">Type: ${b.type || "appointment"}</div>
        <div style="margin-top:12px; display:flex; gap:8px;">
            ${cancelBtn}
            ${b.status === "requested" ? `<button class="btn" data-id="${b.id}" data-action="confirm">Confirm</button>` : ""}
            <a class="btn" href="./vendor.html?id=${b.vendorId}">View Vendor</a>
          </div>
      </div>
    `;
  }).join("");

  // attach cancel handlers
  document.querySelectorAll('button[data-action="cancel"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!id) return;
      btn.disabled = true;
      try {
        await apiDelete(`/bookings/${id}`);
        await load(); // reload list
      } catch (err) {
        alert("Cancel failed: " + err.message);
        btn.disabled = false;
      }
    });
  });

  // attach confirm handlers
  document.querySelectorAll('button[data-action="confirm"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!id) return;
      btn.disabled = true;
      try {
        await apiPost(`/bookings/${id}/confirm`, {});
        await load();
      } catch (err) {
        alert("Confirm failed: " + err.message);
        btn.disabled = false;
      }
    });
  });
}

async function load() {
  try {
    await loadVendorsMap();
    const bookings = await apiGet("/bookings");
    render(bookings);
  } catch (err) {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error loading bookings: ${err.message}</div>`;
  }
}

if (statusFilter) statusFilter.addEventListener("change", load);
if (searchEl) searchEl.addEventListener("input", () => { clearTimeout(window.__bkTimer); window.__bkTimer = setTimeout(load, 220); });
if (refreshBtn) refreshBtn.addEventListener("click", load);

load();