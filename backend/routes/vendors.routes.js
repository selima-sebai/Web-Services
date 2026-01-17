import express from "express";
import { readJson } from "../utils/fileDB.js";
import {
  LEGACY_VENDORS_PATH,
  VENDOR_PROFILES_PATH,
  SERVICES_PATH,
} from "../lib/paths.js";

const router = express.Router();
// Keep categories consistent across the app.
// We store categories as canonical *keys* (e.g. "hairdresser"),
// even if the UI sends the human title (e.g. "Hairdressers").
const CATEGORY_META = {
  hairdresser: { title: "Hairdressers" },
  traditional_clothes_women: { title: "Women’s Traditional Clothes" },
  traditional_clothes_men: { title: "Men’s Traditional Clothes" },
  photographer: { title: "Photographers" },
  wedding_venue: { title: "Wedding Venues" },
  band: { title: "Bands" },
  caterer: { title: "Caterers" },
  decor: { title: "Decor" },
  makeup: { title: "Makeup" },
};

function slugifyCategory(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategoryKey(input) {
  if (!input) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  // Already a known key
  if (CATEGORY_META[raw]) return raw;

  const lower = raw.toLowerCase();

  // Match known titles (case-insensitive)
  for (const [k, meta] of Object.entries(CATEGORY_META)) {
    if (String(meta.title || "").toLowerCase() === lower) return k;
  }

  // Common synonyms (extend freely)
  const synonyms = {
    "beauty salon": "hairdresser",
    "hair salon": "hairdresser",
    salon: "hairdresser",
    coiffure: "hairdresser",
    "make up": "makeup",
    "make-up": "makeup",
  };
  if (synonyms[lower]) return synonyms[lower];

  // If it slugifies to a known key, use it
  const slug = slugifyCategory(raw);
  if (CATEGORY_META[slug]) return slug;

  // Otherwise keep as slug (URL-safe + consistent)
  return slug || raw;
}

function normalizeTimeSlots(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .flatMap((x) => String(x).split(/[,\s]+/))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(input)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}


function normalizeListingFromService(service, profile) {
  const serviceTitle = (service.title || "").trim();
  const displayName = serviceTitle ? `${profile.storeName} — ${serviceTitle}` : profile.storeName;

  return {
    id: service.id,
    name: displayName,
    category: normalizeCategoryKey(service.category || profile.category),
    region: profile.region,
    price: service.price,
    description: service.description || profile.description || "",
    timeSlots: normalizeTimeSlots(service.timeSlots),
    vendorProfileId: profile.id,
    ownerId: profile.ownerId,
    listingType: "service",
  };
}


router.get("/", (req, res) => {
  const { category, region, maxPrice } = req.query;

  const legacy = (readJson(LEGACY_VENDORS_PATH, []) || []).filter(v => !v.migrated);
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  const services = readJson(SERVICES_PATH, []) || [];

  // only approved vendor profiles show publicly
  const approvedProfiles = profiles.filter((p) => p.status === "approved");

  const serviceListings = services
    .map((s) => {
      const p = approvedProfiles.find((x) => x.id === s.vendorProfileId);
      if (!p) return null;
      return normalizeListingFromService(s, p);
    })
    .filter(Boolean);

  // Combine legacy + marketplace services
  let all = [...legacy, ...serviceListings];

  // filters (keep compatible with your existing UI)
  if (category) {
  const want = normalizeCategoryKey(category);
  all = all.filter((v) => normalizeCategoryKey(v.category) === want);
}

  if (region) all = all.filter((v) => String(v.region) === String(region));
  if (maxPrice) all = all.filter((v) => Number(v.price) <= Number(maxPrice));

  res.json(all);
});

router.get("/:id", (req, res) => {
  const id = String(req.params.id);

  const legacy = readJson(LEGACY_VENDORS_PATH, []) || [];
  const foundLegacy = legacy.find((v) => String(v.id) === id);
  if (foundLegacy) return res.json(foundLegacy);

  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  const services = readJson(SERVICES_PATH, []) || [];
  const service = services.find((s) => String(s.id) === id);
  if (!service) return res.status(404).json({ error: "Vendor/service not found" });

  const profile = profiles.find((p) => p.id === service.vendorProfileId);
  if (!profile || profile.status !== "approved") {
    return res.status(404).json({ error: "Vendor/service not found" });
  }

  return res.json(normalizeListingFromService(service, profile));
});

export default router;