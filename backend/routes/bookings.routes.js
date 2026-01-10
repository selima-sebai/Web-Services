import express from "express";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth } from "../middleware/auth.js";
import {
  BOOKINGS_PATH,
  LEGACY_VENDORS_PATH,
  VENDOR_PROFILES_PATH,
  SERVICES_PATH,
  BUDGETS_PATH,
} from "../lib/paths.js";

const router = express.Router();

function findListingById(listingId) {
  const legacy = readJson(LEGACY_VENDORS_PATH, []) || [];
  const legacyItem = legacy.find((v) => String(v.id) === String(listingId));
  if (legacyItem) return { kind: "legacy", item: legacyItem };

  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  const services = readJson(SERVICES_PATH, []) || [];
  const svc = services.find((s) => String(s.id) === String(listingId));
  if (!svc) return null;
  const profile = profiles.find((p) => p.id === svc.vendorProfileId && p.status === "approved");
  if (!profile) return null;

  // normalized listing shape
  return {
    kind: "service",
    item: {
      id: svc.id,
      category: svc.category,
      price: svc.price,
      timeSlots: svc.timeSlots || [],
      vendorProfileId: profile.id,
      ownerId: profile.ownerId, // vendor user id
      name: `${profile.storeName} — ${svc.title}`,
      region: profile.region,
    },
  };
}

function getOrCreateBudget(clientId) {
  const budgets = readJson(BUDGETS_PATH, []) || [];
  let b = budgets.find((x) => x.clientId === clientId);
  if (!b) {
    b = { clientId, total: 0, allocations: {}, actuals: {}, records: [], updatedAt: new Date().toISOString() };
    budgets.push(b);
    writeJson(BUDGETS_PATH, budgets);
  }
  return b;
}

function saveBudget(budget) {
  const budgets = readJson(BUDGETS_PATH, []) || [];
  const idx = budgets.findIndex((x) => x.clientId === budget.clientId);
  budget.updatedAt = new Date().toISOString();
  if (idx >= 0) budgets[idx] = budget;
  else budgets.push(budget);
  writeJson(BUDGETS_PATH, budgets);
}

router.get("/", requireAuth, (req, res) => {
  const all = readJson(BOOKINGS_PATH, []) || [];
  const mine = all.filter((b) => b.clientId === req.user.id);
  res.json(mine);
});

router.post("/", requireAuth, (req, res) => {
  const { vendorId, date, timeSlot, type } = req.body || {};

  if (!vendorId || !date) return res.status(400).json({ error: "vendorId and date are required" });

  const listing = findListingById(vendorId);
  if (!listing) return res.status(404).json({ error: "Vendor/service not found" });

  const bookings = readJson(BOOKINGS_PATH, []) || [];

  const conflict = bookings.some(
    (b) =>
      String(b.vendorId) === String(vendorId) &&
      b.date === date &&
      String(b.timeSlot || "") === String(timeSlot || "") &&
      b.status !== "cancelled" &&
      b.status !== "declined"
  );

  if (conflict) return res.status(409).json({ error: "This slot is already booked" });

  const booking = {
    id: uuid(),
    clientId: req.user.id,
    vendorId, // listing id (legacy vendor or service id)
    date,
    timeSlot: timeSlot ?? null,
    type: type || listing.item.category || "appointment",
    status: "requested", // requested -> accepted/declined -> completed
    createdAt: new Date().toISOString(),

    // vendor ownership (only filled for marketplace services)
    vendorOwnerId: listing.item.ownerId || null,
    vendorProfileId: listing.item.vendorProfileId || null,
  };

  bookings.push(booking);
  writeJson(BOOKINGS_PATH, bookings);

  res.status(201).json(booking);
});

router.delete("/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  const bookings = readJson(BOOKINGS_PATH, []) || [];
  const b = bookings.find((x) => x.id === id);

  if (!b) return res.status(404).json({ error: "Booking not found" });
  if (b.clientId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  b.status = "cancelled";
  b.cancelledAt = new Date().toISOString();
  writeJson(BOOKINGS_PATH, bookings);

  res.json({ ok: true });
});

// keep your old confirm button behavior (client confirm) — optional realism
router.post("/:id/confirm", requireAuth, (req, res) => {
  const id = req.params.id;
  const bookings = readJson(BOOKINGS_PATH, []) || [];
  const b = bookings.find((x) => x.id === id);

  if (!b) return res.status(404).json({ error: "Booking not found" });
  if (b.clientId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  if (b.status === "cancelled") return res.status(400).json({ error: "Booking cancelled" });

  // confirm it
  b.status = "confirmed";
  b.confirmedAt = new Date().toISOString();
  writeJson(BOOKINGS_PATH, bookings);

  // budget add (based on listing price)
  const listing = findListingById(b.vendorId);
  const price = listing ? Number(listing.item.price) || 0 : 0;
  const category = b.type || (listing?.item.category ?? "other");

  const budget = getOrCreateBudget(req.user.id);
  budget.actuals[category] = (budget.actuals[category] || 0) + price;
  budget.records.unshift({
    id: uuid(),
    date: new Date().toISOString().slice(0, 10),
    category,
    amount: price,
    bookingId: b.id,
    vendorId: b.vendorId,
  });
  saveBudget(budget);

  res.json({ ok: true, booking: b, budget });
});

export default router;

