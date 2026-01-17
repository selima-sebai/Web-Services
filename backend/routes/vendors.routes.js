import express from "express";
import { readJson } from "../utils/fileDB.js";
import {
  LEGACY_VENDORS_PATH,
  VENDOR_PROFILES_PATH,
  SERVICES_PATH,
} from "../lib/paths.js";

const router = express.Router();

function normalizeListingFromService(service, profile) {
  const serviceTitle = (service.title || "").trim();
  const displayName = serviceTitle ? `${profile.storeName} — ${serviceTitle}` : profile.storeName;

  return {
    id: service.id,
    name: displayName,
    category: service.category,
    region: profile.region,
    price: service.price,
    description: service.description || profile.description || "",
    timeSlots: service.timeSlots || [],
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
  if (category) all = all.filter((v) => String(v.category) === String(category));
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