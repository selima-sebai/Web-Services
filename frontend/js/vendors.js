import { apiGet, getUser } from "./api.js";

// If logged in as vendor, force dashboard-only experience
const u = getUser();
if (u?.role === "vendor") location.href = "./vendor-dashboard.html";
if (u?.role === "admin") location.href = "./admin.html";

const params = new URLSearchParams(location.search);
const category = params.get("category") || "";

const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");

const categoriesWrap = document.getElementById("categoriesWrap");
const categoriesEl = document.getElementById("categories");

const vendorsWrap = document.getElementById("vendorsWrap");
const listEl = document.getElementById("list");

const regionEl = document.getElementById("region");
const maxPriceEl = document.getElementById("maxPrice");

const backBtn = document.getElementById("backBtn");

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function iconFor(key) {
  const map = {
    hairdresser: "💇‍♀️",
    photographer: "📸",
    wedding_venue: "🏛️",
    band: "🥁",
    decor: "🌸",
    caterer: "🍽️",
    traditional_clothes_women: "👗",
    traditional_clothes_men: "🕴️",
    makeup: "💄",
  };
  return map[key] || "✨";
}

async function loadCategories() {
  titleEl.textContent = "Choose a category";
  subtitleEl.textContent = "Pick a category to browse vendors and services.";
  backBtn.style.display = "none";

  categoriesWrap.style.display = "";
  vendorsWrap.style.display = "none";

  const cats = await apiGet("/categories");

  if (!cats.length) {
    categoriesEl.innerHTML = `<div class="item" style="grid-column: span 12;">No categories found.</div>`;
    return;
  }

  categoriesEl.innerHTML = cats
    .map(
      (c) => `
      <div class="item">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div class="title">${iconFor(c.key)} ${esc(c.title || c.key)}</div>
          <span class="badge">${esc(c.key)}</span>
        </div>

        <div class="description">
          ${esc(c.desc || "Browse vendors in this category.")}
        </div>

        <a class="card-btn" href="./vendors.html?category=${encodeURIComponent(c.key)}">
          Explore
        </a>
      </div>
    `
    )
    .join("");
}

async function loadVendors() {
  backBtn.style.display = "";
  categoriesWrap.style.display = "none";
  vendorsWrap.style.display = "";

  try {
    const cats = await apiGet("/categories");
    const found = cats.find((x) => x.key === category);
    titleEl.textContent = found ? found.title : `Vendors — ${category}`;
    subtitleEl.textContent = found?.desc || "Filter by region and max price.";
  } catch {
    titleEl.textContent = `Vendors — ${category}`;
    subtitleEl.textContent = "Filter by region and max price.";
  }

  const q = new URLSearchParams();
  q.set("category", category);
  if (regionEl?.value) q.set("region", regionEl.value);
  if (maxPriceEl?.value) q.set("maxPrice", maxPriceEl.value);

  const listings = await apiGet(`/vendors?${q.toString()}`);

  if (!listings.length) {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">No vendors found for this category.</div>`;
    return;
  }

  // Split legacy vs services
  const legacy = listings.filter((x) => x.listingType !== "service" || !x.vendorProfileId);
  const services = listings.filter((x) => x.listingType === "service" && x.vendorProfileId);

  // Group services by vendorProfileId
  const groups = new Map();
  for (const s of services) {
    const key = s.vendorProfileId;
    if (!groups.has(key)) {
      // storeName is the first part before " — "
      const storeName = String(s.name || "").split(" — ")[0] || "Vendor";
      groups.set(key, {
        vendorProfileId: key,
        storeName,
        region: s.region,
        services: [],
      });
    }
    groups.get(key).services.push(s);
  }

  const groupedCardsHtml = Array.from(groups.values())
    .map((g) => {
      const serviceRows = g.services
        .map((s) => {
          // service title is the part after " — "
          const title = (String(s.name || "").split(" — ")[1] || s.category || "Service").trim();
          return `
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(0,0,0,0.06);">
              <div>
                <div style="font-weight:800">${esc(title || "Service")}</div>
                <div class="meta">${esc(s.category)} • <strong>${esc(s.price)} TND</strong></div>
                ${s.timeSlots?.length ? `<div class="meta">${esc(s.timeSlots.join(", "))}</div>` : ""}
              </div>
              <a class="card-btn" style="min-width:110px;text-align:center" href="./vendor.html?id=${encodeURIComponent(s.id)}">View</a>
            </div>
          `;
        })
        .join("");

      return `
        <div class="item">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div class="title">${esc(g.storeName)}</div>
            <span class="badge">store</span>
          </div>

          <div class="region-pill">${esc(g.region || "Region")}</div>

          <div class="description">
            Services (${g.services.length})
          </div>

          <div>
            ${serviceRows}
          </div>
        </div>
      `;
    })
    .join("");

  const legacyCardsHtml = legacy
    .map(
      (v) => `
      <div class="item">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div class="title">${esc(v.name)}</div>
          <span class="badge">${esc(v.category)}</span>
        </div>

        <div class="region-pill">${esc(v.region || "Region")}</div>
        <div class="meta"><strong>${esc(v.price)} TND</strong></div>

        <div class="description">
          ${esc(v.description || "Professional wedding service.")}
        </div>

        <a class="card-btn" href="./vendor.html?id=${encodeURIComponent(v.id)}">
          View
        </a>
      </div>
    `
    )
    .join("");

  // Show grouped services first, then legacy
  listEl.innerHTML = groupedCardsHtml + legacyCardsHtml;
}

document.getElementById("apply")?.addEventListener("click", () => {
  loadVendors().catch((err) => {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(err.message)}</div>`;
  });
});

document.getElementById("clear")?.addEventListener("click", () => {
  if (regionEl) regionEl.value = "";
  if (maxPriceEl) maxPriceEl.value = "";
  loadVendors().catch((err) => {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(err.message)}</div>`;
  });
});

(async () => {
  try {
    if (!category) await loadCategories();
    else await loadVendors();
  } catch (err) {
    categoriesEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(err.message)}</div>`;
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(err.message)}</div>`;
  }
})();
