import { apiGet } from "./api.js";

const wrap = document.getElementById("categories");

async function renderCategories() {
  try {
    const categories = await apiGet('/categories');
    wrap.innerHTML = (categories || []).map(c => `
      <div class="card">
        <div class="inner">
          <div class="row" style="justify-content:space-between;">
            <span class="badge">${c.key}</span>
            <a class="btn primary" href="./vendors.html?category=${encodeURIComponent(c.key)}">Explore</a>
          </div>
          <h3 style="margin-top:12px;">${c.title}</h3>
          <p>${c.desc}</p>
        </div>
      </div>
    `).join("");
  } catch (err) {
    // fallback to the old hard-coded list if API fails (keeps site usable during development)
    const fallback = [
      { key: "hairdresser", title: "Hairdressers", desc: "Bridal hair + makeup, henna night." },
      { key: "traditional_clothes_women", title: "Women’s Traditional Clothes", desc: "Try-on appointments + rental/purchase." },
      { key: "traditional_clothes_men", title: "Men’s Traditional Clothes", desc: "Jebba & classic sets." },
      { key: "photographer", title: "Photographers", desc: "Traditional & cinematic styles." },
      { key: "wedding_venue", title: "Wedding Venues", desc: "Capacity, type, amenities." },
      { key: "band", title: "Bands", desc: "Mezoued, stambeli, folk, DJ sets." },
      { key: "caterer", title: "Caterers", desc: "Menus & per-person packages." }
    ];
    wrap.innerHTML = fallback.map(c => `
      <div class="card">
        <div class="inner">
          <div class="row" style="justify-content:space-between;">
            <span class="badge">${c.key}</span>
            <a class="btn primary" href="./vendors.html?category=${encodeURIComponent(c.key)}">Explore</a>
          </div>
          <h3 style="margin-top:12px;">${c.title}</h3>
          <p>${c.desc}</p>
        </div>
      </div>
    `).join("");
  }
}

renderCategories();
