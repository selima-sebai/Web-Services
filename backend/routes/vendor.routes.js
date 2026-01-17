import express from "express";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { VENDOR_PROFILES_PATH, SERVICES_PATH, BOOKINGS_PATH, USERS_PATH } from "../lib/paths.js";
import { notifyUser } from "../utils/mailer.js";

const router = express.Router();
router.use(requireAuth, requireRole("vendor"));
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
  // Accept array OR string. Return array of clean strings.
  if (!input) return [];

  // If already array: flatten and split any "10:00 12:00" single-string entries
  if (Array.isArray(input)) {
    return input
      .flatMap((x) => String(x).split(/[,\s]+/))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // If string: allow "10:00,12:00" OR "10:00 12:00"
  return String(input)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}


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
  const { storeName, region, description, category } = req.body || {};
if (!storeName || !region || !category) {
  return res.status(400).json({ error: "storeName, region, and category are required" });
}


  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  if (profiles.some((p) => p.ownerId === req.user.id)) {
    return res.status(409).json({ error: "Vendor profile already exists" });
  }

  const normalizedCategory = normalizeCategoryKey(category);
if (!normalizedCategory) {
  return res.status(400).json({ error: "category is invalid" });
}

const profile = {
  id: uuid(),
  ownerId: req.user.id,
  storeName: String(storeName),
  region: String(region),
  category: normalizedCategory,
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
  const { storeName, region, description, category } = req.body || {};

  if (category !== undefined) {
  const normalizedCategory = normalizeCategoryKey(category);
  if (!normalizedCategory) {
    return res.status(400).json({ error: "category is invalid" });
  }
  p.category = normalizedCategory;
}

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
if (!title) return res.status(400).json({ error: "title is required" });

const finalCategory = normalizeCategoryKey(
  category ? String(category) : (profile.category ? String(profile.category) : "")
);
if (!finalCategory) return res.status(400).json({ error: "category is required" });


  const svc = {
    id: uuid(),
    vendorProfileId: profile.id,
    title: String(title),
    category: finalCategory,
    price: Number(price) || 0,
    description: description ? String(description) : "",
    timeSlots: normalizeTimeSlots(timeSlots),
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
