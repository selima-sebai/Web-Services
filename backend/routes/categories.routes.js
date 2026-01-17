import express from "express";
import { readJson } from "../utils/fileDB.js";
import { LEGACY_VENDORS_PATH, SERVICES_PATH, VENDOR_PROFILES_PATH } from "../lib/paths.js";

const router = express.Router();

// Canonical categories (keys). Only these will ever be returned by /api/categories
const CATEGORY_META = {
  hairdresser: { title: "Hairdresser", desc: "Browse vendors in this category." },
  traditional_clothes_women: { title: "Women’s Traditional Clothes", desc: "Browse vendors in this category." },
  traditional_clothes_men: { title: "Men’s Traditional Clothes", desc: "Browse vendors in this category." },
  photographer: { title: "Photographers", desc: "Browse vendors in this category." },
  wedding_venue: { title: "Wedding Venues", desc: "Browse vendors in this category." },
  band: { title: "Bands", desc: "Browse vendors in this category." },
  caterer: { title: "Caterers", desc: "Traditional menus + modern options." },
  decor: { title: "Decor", desc: "Browse vendors in this category." },
  makeup: { title: "Makeup", desc: "Browse vendors in this category." },
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

  // already a known key
  if (CATEGORY_META[raw]) return raw;

  const lower = raw.toLowerCase();

  // if user stored the TITLE as category, map it back to the key
  for (const [k, meta] of Object.entries(CATEGORY_META)) {
    if (String(meta.title || "").toLowerCase() === lower) return k;
  }

  // common synonyms
  const synonyms = {
    "beauty salon": "hairdresser",
    "hair salon": "hairdresser",
    salon: "hairdresser",
    coiffure: "hairdresser",
    "wedding venues": "wedding_venue",
    "women’s traditional clothes": "traditional_clothes_women",
    "women's traditional clothes": "traditional_clothes_women",
  };
  if (synonyms[lower]) return synonyms[lower];

  // slugify and keep only if it's a known canonical key
  const slug = slugifyCategory(raw);
  if (CATEGORY_META[slug]) return slug;

  // unknown categories are ignored (prevents new random boxes)
  return "";
}

router.get("/", (req, res) => {
  try {
    const legacyVendors = readJson(LEGACY_VENDORS_PATH, []) || [];
    const services = readJson(SERVICES_PATH, []) || [];
    const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];

    // Only approved vendors should contribute categories
    const approvedProfileIds = new Set(
      profiles.filter((p) => p.status === "approved").map((p) => p.id)
    );

    const keys = new Set();

    // from legacy vendors.json (if exists)
    for (const v of legacyVendors) {
      const k = normalizeCategoryKey(v?.category);
      if (k) keys.add(k);
    }

    // from approved vendor profiles
    for (const p of profiles) {
      if (p?.status !== "approved") continue;
      const k = normalizeCategoryKey(p?.category);
      if (k) keys.add(k);
    }

    // from services.json of approved vendors
    for (const s of services) {
      if (!approvedProfileIds.has(s?.vendorProfileId)) continue;
      const k = normalizeCategoryKey(s?.category);
      if (k) keys.add(k);
    }

    // Return only canonical categories (no titles as keys)
    const categories = Array.from(keys).map((k) => ({
      key: k,
      title: CATEGORY_META[k].title,
      desc: CATEGORY_META[k].desc,
    }));

    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: "Failed to load categories" });
  }
});

export default router;
