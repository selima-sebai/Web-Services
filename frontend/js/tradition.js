import { apiGet, resolveUrl, getUser } from "./api.js";

const u = getUser();
if (u?.role === "vendor") location.href = "./vendor-dashboard.html";
if (u?.role === "admin") location.href = "./admin.html";

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

const id = qs("id");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const detailsEl = document.getElementById("details");
const galleryEl = document.getElementById("gallery");

if (!id) {
  titleEl.textContent = "No tradition selected";
  detailsEl.textContent = "Please go back and choose a tradition.";
} else {
  apiGet(`/traditions/${id}`)
    .then((t) => {
      titleEl.textContent = t.title || "Tradition";
      subtitleEl.textContent = t.region || "";
      detailsEl.textContent = t.details || t.summary || "";

      const images = Array.isArray(t.images) ? t.images : [];
      if (images.length) {
        galleryEl.innerHTML = images
          .map((src) => `<img class="gallery-img" src="${resolveUrl(src)}" alt="${t.title || "Tradition"}">`)
          .join("");
      } else {
        galleryEl.innerHTML = "";
      }
    })
    .catch((err) => {
      titleEl.textContent = "Error loading tradition";
      detailsEl.textContent = err.message;
      galleryEl.innerHTML = "";
    });
}
