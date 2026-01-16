import { apiGet, resolveUrl, getUser } from "./api.js";

const u = getUser();
if (u?.role === "vendor") location.href = "./vendor-dashboard.html";
if (u?.role === "admin") location.href = "./admin.html";

const listEl = document.getElementById("traditionsList");

async function load() {
  const items = await apiGet("/traditions");

  if (!items.length) {
    listEl.innerHTML = `<div class="item" style="grid-column: span 12;">No traditions found.</div>`;
    return;
  }

  listEl.innerHTML = items
    .map((t) => {
      const firstImg = Array.isArray(t.images) && t.images.length ? resolveUrl(t.images[0]) : "";

      return `
        <div class="item">
          <div class="row" style="justify-content:space-between;">
            <span class="badge">${t.region || ""}</span>
          </div>

          <h3 style="margin:10px 0 0 0;">${t.title || ""}</h3>
          <div class="meta" style="margin-top:8px;">${t.summary || ""}</div>

          ${firstImg ? `<img class="card-img" src="${firstImg}" alt="${t.title || "Tradition"}">` : ""}

          <div style="margin-top:12px;">
            <a class="btn" href="./tradition.html?id=${t.id}">Read more</a>
          </div>
        </div>
      `;
    })
    .join("");
}

load().catch((err) => {
  listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error loading traditions: ${err.message}</div>`;
});
