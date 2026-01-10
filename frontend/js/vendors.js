import { apiGet } from "./api.js";

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

// Optional: icons per category (safe fallback)
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

  // Nice title/subtitle from categories (optional)
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

  const vendors = await apiGet(`/vendors?${q.toString()}`);

  if (!vendors.length) {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">No vendors found for this category.</div>`;
    return;
  }

  listEl.innerHTML = vendors
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
          Book now
        </a>
      </div>
    `
    )
    .join("");
}

// Buttons
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

// Boot
(async () => {
  try {
    if (!category) await loadCategories();
    else await loadVendors();
  } catch (err) {
    categoriesEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(err.message)}</div>`;
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(err.message)}</div>`;
  }
})();

