import express from "express";
import path from "path";
import { readJson } from "../utils/fileDB.js";

const router = express.Router();

// Data paths
const DATA_DIR = path.join(process.cwd(), "Data");
const LEGACY_VENDORS_PATH = path.join(DATA_DIR, "vendors.json");
const SERVICES_PATH = path.join(DATA_DIR, "services.json");
const VENDOR_PROFILES_PATH = path.join(DATA_DIR, "vendorProfiles.json");

function humanizeKey(key) {
  const map = {
    hairdresser: { title: "Hairdressers", desc: "Bridal hair + makeup, henna night." },
    traditional_clothes_women: { title: "Women’s Traditional Clothes", desc: "Try-on appointments + rental/purchase." },
    traditional_clothes_men: { title: "Men’s Traditional Clothes", desc: "Jebba & classic sets." },
    photographer: { title: "Photographers", desc: "Traditional & cinematic styles." },
    wedding_venue: { title: "Wedding Venues", desc: "Capacity, type, amenities." },
    band: { title: "Bands", desc: "Mezoued, stambeli, folk, DJ sets." },
    caterer: { title: "Caterers", desc: "Traditional menus + modern options." },
    decor: { title: "Decor", desc: "Flowers, stage, lighting, theme." },
  };

  // fallback if unknown
  return map[key] || {
    title: key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    desc: "Browse vendors in this category.",
  };
}

// GET /api/categories
router.get("/", (req, res) => {
  try {
    const legacyVendors = readJson(LEGACY_VENDORS_PATH, []) || [];
    const services = readJson(SERVICES_PATH, []) || [];
    const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];

    const approvedProfileIds = new Set(
      profiles.filter((p) => p.status === "approved").map((p) => p.id)
    );

    const keys = new Set();

    // Categories from old vendors.json
    for (const v of legacyVendors) {
      if (v?.category) keys.add(String(v.category));
    }

    // Categories from new marketplace services (only if vendor approved)
    for (const s of services) {
      if (s?.category && approvedProfileIds.has(s.vendorProfileId)) {
        keys.add(String(s.category));
      }
    }

    const categories = Array.from(keys).map((k) => ({ key: k, ...humanizeKey(k) }));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to load categories" });
  }
});

export default router;
