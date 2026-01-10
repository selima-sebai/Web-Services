import express from "express";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { VENDOR_PROFILES_PATH, SERVICES_PATH, BOOKINGS_PATH } from "../lib/paths.js";

const router = express.Router();

router.use(requireAuth, requireRole("vendor"));

function getMyProfile(ownerId) {
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  return profiles.find((p) => p.ownerId === ownerId) || null;
}

// Create/apply vendor profile
router.post("/apply", (req, res) => {
  const { storeName, region, description } = req.body || {};
  if (!storeName || !region) return res.status(400).json({ error: "storeName and region are required" });

  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  if (profiles.some((p) => p.ownerId === req.user.id)) {
    return res.status(409).json({ error: "Vendor profile already exists" });
  }

  const profile = {
    id: uuid(),
    ownerId: req.user.id,
    storeName: String(storeName),
    region: String(region),
    description: description ? String(description) : "",
    status: "pending", // admin approves
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  profiles.push(profile);
  writeJson(VENDOR_PROFILES_PATH, profiles);

  res.status(201).json(profile);
});

// View my vendor profile
router.get("/me", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Vendor profile not found. Apply first." });
  res.json(profile);
});

// Edit my vendor profile
router.patch("/me", (req, res) => {
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  const idx = profiles.findIndex((p) => p.ownerId === req.user.id);
  if (idx < 0) return res.status(404).json({ error: "Vendor profile not found. Apply first." });

  const p = profiles[idx];
  const { storeName, region, description } = req.body || {};
  if (storeName !== undefined) p.storeName = String(storeName);
  if (region !== undefined) p.region = String(region);
  if (description !== undefined) p.description = String(description);

  p.updatedAt = new Date().toISOString();
  profiles[idx] = p;
  writeJson(VENDOR_PROFILES_PATH, profiles);

  res.json(p);
});

// Create a service
router.post("/services", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: "Create vendor profile first (/vendor/apply)" });
  // allow vendor to create services even if pending (admin approval controls visibility)
  const { title, category, price, description, timeSlots } = req.body || {};
  if (!title || !category) return res.status(400).json({ error: "title and category are required" });

  const svc = {
    id: uuid(),
    vendorProfileId: profile.id,
    title: String(title),
    category: String(category),
    price: Number(price) || 0,
    description: description ? String(description) : "",
    timeSlots: Array.isArray(timeSlots) ? timeSlots.map(String) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const services = readJson(SERVICES_PATH, []) || [];
  services.push(svc);
  writeJson(SERVICES_PATH, services);

  res.status(201).json(svc);
});

// List my services
router.get("/services", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.json([]);
  const services = readJson(SERVICES_PATH, []) || [];
  res.json(services.filter((s) => s.vendorProfileId === profile.id));
});

// Update my service
router.patch("/services/:id", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: "Create vendor profile first" });

  const services = readJson(SERVICES_PATH, []) || [];
  const idx = services.findIndex((s) => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Service not found" });

  const svc = services[idx];
  if (svc.vendorProfileId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  const { title, category, price, description, timeSlots } = req.body || {};
  if (title !== undefined) svc.title = String(title);
  if (category !== undefined) svc.category = String(category);
  if (price !== undefined) svc.price = Number(price) || 0;
  if (description !== undefined) svc.description = String(description);
  if (timeSlots !== undefined) svc.timeSlots = Array.isArray(timeSlots) ? timeSlots.map(String) : [];

  svc.updatedAt = new Date().toISOString();
  services[idx] = svc;
  writeJson(SERVICES_PATH, services);

  res.json(svc);
});

// Delete my service
router.delete("/services/:id", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: "Create vendor profile first" });

  const services = readJson(SERVICES_PATH, []) || [];
  const svc = services.find((s) => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: "Service not found" });
  if (svc.vendorProfileId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  const next = services.filter((s) => s.id !== req.params.id);
  writeJson(SERVICES_PATH, next);

  res.json({ ok: true });
});

// Vendor sees bookings for their services and can accept/decline
router.get("/bookings", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.json([]);

  const bookings = readJson(BOOKINGS_PATH, []) || [];
  // bookings created from services store vendorProfileId
  const mine = bookings.filter((b) => b.vendorProfileId === profile.id);
  res.json(mine);
});

router.patch("/bookings/:id/status", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: "Create vendor profile first" });

  const { status } = req.body || {};
  const allowed = ["accepted", "declined", "completed"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const bookings = readJson(BOOKINGS_PATH, []) || [];
  const idx = bookings.findIndex((b) => b.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Booking not found" });

  const b = bookings[idx];
  if (b.vendorProfileId !== profile.id) return res.status(403).json({ error: "Forbidden" });

  b.status = status;
  b.updatedAt = new Date().toISOString();
  writeJson(BOOKINGS_PATH, bookings);

  res.json(b);
});

export default router;
