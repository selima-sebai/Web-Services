import express from "express";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { VENDOR_PROFILES_PATH, SERVICES_PATH, BOOKINGS_PATH, USERS_PATH } from "../lib/paths.js";
import { notifyUser } from "../utils/mailer.js";

const router = express.Router();
router.use(requireAuth, requireRole("vendor"));

function getMyProfile(ownerId) {
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  return profiles.find((p) => p.ownerId === ownerId) || null;
}

function findUserById(userId) {
  const users = readJson(USERS_PATH, []) || [];
  return users.find((u) => String(u.id) === String(userId)) || null;
}

// Apply/create vendor profile
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
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  profiles.push(profile);
  writeJson(VENDOR_PROFILES_PATH, profiles);

  res.status(201).json(profile);
});

// Get my profile
router.get("/me", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Vendor profile not found. Apply first." });
  res.json(profile);
});

// Update my profile
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

// Create service
router.post("/services", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: "Create vendor profile first (/vendor/apply)" });
  if (profile.status !== "approved") return res.status(403).json({ error: "Vendor not approved yet" });

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

// Vendor: list my bookings
router.get("/bookings", (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.json([]);

  const bookings = readJson(BOOKINGS_PATH, []) || [];

  const mine = bookings.filter(
    (b) => b.vendorProfileId === profile.id || b.vendorOwnerId === req.user.id
  );

  // attach client email for UI convenience
  const users = readJson(USERS_PATH, []) || [];
  const userById = new Map(users.map((u) => [String(u.id), u]));

  res.json(
    mine.map((b) => ({
      ...b,
      clientEmail: userById.get(String(b.clientId))?.email || null,
    }))
  );
});

// Vendor: update booking status (accepted/declined/completed)
router.patch("/bookings/:id/status", async (req, res) => {
  const profile = getMyProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: "Create vendor profile first" });

  const { status } = req.body || {};
  const allowed = ["accepted", "declined", "completed"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const bookings = readJson(BOOKINGS_PATH, []) || [];
  const idx = bookings.findIndex((b) => String(b.id) === String(req.params.id));
  if (idx < 0) return res.status(404).json({ error: "Booking not found" });

  const b = bookings[idx];

  const ownsByProfile = b.vendorProfileId && b.vendorProfileId === profile.id;
  const ownsByOwnerId = b.vendorOwnerId && b.vendorOwnerId === req.user.id;
  if (!ownsByProfile && !ownsByOwnerId) return res.status(403).json({ error: "Forbidden" });

  b.status = status;
  b.updatedAt = new Date().toISOString();
  if (status === "accepted") b.acceptedAt = new Date().toISOString();
  if (status === "declined") b.declinedAt = new Date().toISOString();
  if (status === "completed") b.completedAt = new Date().toISOString();

  writeJson(BOOKINGS_PATH, bookings);

  // Notify client
  const clientUser = findUserById(b.clientId);
  if (clientUser?.email) {
    const title =
      status === "accepted"
        ? "Vendor accepted your booking"
        : status === "declined"
        ? "Vendor declined your booking"
        : "Booking marked completed";

    await notifyUser({
      toUserId: clientUser.id,
      toEmail: clientUser.email,
      toRole: "client",
      title,
      message:
        `${title}\n\n` +
        `Date: ${b.date}\n` +
        `Time: ${b.timeSlot || "N/A"}\n` +
        `Type: ${b.type || "appointment"}\n` +
        `Booking ID: ${b.id}\n` +
        `Status: ${b.status}`,
      event: `booking_${status}`,
      refId: b.id,
    });
  }

  res.json(b);
});

export default router;
