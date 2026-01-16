import express from "express";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

import {
  BOOKINGS_PATH,
  LEGACY_VENDORS_PATH,
  VENDOR_PROFILES_PATH,
  SERVICES_PATH,
  BUDGETS_PATH,
  USERS_PATH,
} from "../lib/paths.js";

import { notifyUser } from "../utils/mailer.js";

const router = express.Router();
router.use(requireAuth, requireRole("client"));

function findUserById(userId) {
  const users = readJson(USERS_PATH, []) || [];
  return users.find((u) => String(u.id) === String(userId)) || null;
}

/**
 * listingId can be:
 * - legacy vendor (Data/vendors.json)
 * - service id (Data/services.json) linked to approved vendor profile
 */
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

  return {
    kind: "service",
    item: {
      id: svc.id,
      category: svc.category,
      price: svc.price,
      timeSlots: svc.timeSlots || [],
      vendorProfileId: profile.id,
      ownerId: profile.ownerId, // vendor user id
      name: `${profile.storeName}${svc.title ? ` — ${svc.title}` : ""}`,
      region: profile.region,
    },
  };
}

function getOrCreateBudget(clientId) {
  const budgets = readJson(BUDGETS_PATH, []) || [];
  let b = budgets.find((x) => x.clientId === clientId);
  if (!b) {
    b = {
      clientId,
      total: 0,
      allocations: {},
      actuals: {},
      records: [],
      updatedAt: new Date().toISOString(),
    };
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

// GET /api/bookings -> my bookings
router.get("/", (req, res) => {
  try {
    const all = readJson(BOOKINGS_PATH, []) || [];
    const mine = all.filter((b) => b.clientId === req.user.id);
    res.json(mine);
  } catch (e) {
    console.error("GET /api/bookings failed:", e?.message || e);
    res.status(500).json({ error: "Server error while fetching bookings" });
  }
});

// POST /api/bookings -> create booking request
router.post("/", async (req, res) => {
  try {
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
        !["cancelled", "declined"].includes(b.status)
    );
    if (conflict) return res.status(409).json({ error: "This slot is already booked" });

    const booking = {
      id: uuid(),
      clientId: req.user.id,
      vendorId,
      date,
      timeSlot: timeSlot ?? null,
      type: type || listing.item.category || "appointment",
      status: "requested",
      createdAt: new Date().toISOString(),

      vendorOwnerId: listing.item.ownerId || null,
      vendorProfileId: listing.item.vendorProfileId || null,
    };

    bookings.push(booking);
    writeJson(BOOKINGS_PATH, bookings);

    // ✅ Notify client (ALWAYS creates in-app notification; email if available)
    try {
      const clientUser = findUserById(req.user.id);
      await notifyUser({
        toUserId: req.user.id,
        toEmail: clientUser?.email || null,
        toRole: "client",
        title: "Booking request sent",
        message:
          `Your booking request was sent ✅\n\n` +
          `Vendor/Service: ${listing.item.name || listing.item.category || "Vendor"}\n` +
          `Date: ${booking.date}\n` +
          `Time: ${booking.timeSlot || "N/A"}\n` +
          `Type: ${booking.type}\n` +
          `Booking ID: ${booking.id}\n\n` +
          `You can track updates in Notifications.`,
        event: "booking_requested_client",
        refId: booking.id,
      });
    } catch (e) {
      console.error("Client notify failed (booking still created):", e?.message || e);
    }

    // Notify vendor (only if service listing has ownerId)
    if (booking.vendorOwnerId) {
      try {
        const vendorUser = findUserById(booking.vendorOwnerId);
        if (vendorUser?.email) {
          await notifyUser({
            toUserId: vendorUser.id,
            toEmail: vendorUser.email,
            toRole: "vendor",
            title: "New booking request",
            message:
              `You received a new booking request.\n\n` +
              `Date: ${booking.date}\n` +
              `Time: ${booking.timeSlot || "N/A"}\n` +
              `Type: ${booking.type}\n` +
              `Booking ID: ${booking.id}\n\n` +
              `Open Vendor Dashboard to accept/decline.`,
            event: "booking_requested",
            refId: booking.id,
          });
        }
      } catch (e) {
        console.error("Vendor notify failed (booking still created):", e?.message || e);
      }
    }

    res.status(201).json(booking);
  } catch (e) {
    console.error("POST /api/bookings failed:", e?.message || e);
    res.status(500).json({ error: "Server error while creating booking" });
  }
});

// DELETE /api/bookings/:id -> cancel my booking
router.delete("/:id", async (req, res) => {
  try {
    const bookings = readJson(BOOKINGS_PATH, []) || [];
    const b = bookings.find((x) => String(x.id) === String(req.params.id));
    if (!b) return res.status(404).json({ error: "Booking not found" });
    if (b.clientId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    b.status = "cancelled";
    b.cancelledAt = new Date().toISOString();
    writeJson(BOOKINGS_PATH, bookings);

    // Notify vendor
    if (b.vendorOwnerId) {
      try {
        const vendorUser = findUserById(b.vendorOwnerId);
        if (vendorUser?.email) {
          await notifyUser({
            toUserId: vendorUser.id,
            toEmail: vendorUser.email,
            toRole: "vendor",
            title: "Booking cancelled",
            message:
              `A client cancelled a booking.\n\n` +
              `Date: ${b.date}\n` +
              `Time: ${b.timeSlot || "N/A"}\n` +
              `Type: ${b.type}\n` +
              `Booking ID: ${b.id}`,
            event: "booking_cancelled",
            refId: b.id,
          });
        }
      } catch (e) {
        console.error("Vendor cancel notify failed:", e?.message || e);
      }
    }

    // Optional: Notify client too
    try {
      const clientUser = findUserById(req.user.id);
      await notifyUser({
        toUserId: req.user.id,
        toEmail: clientUser?.email || null,
        toRole: "client",
        title: "Booking cancelled",
        message:
          `Your booking was cancelled ❌\n\n` +
          `Date: ${b.date}\n` +
          `Time: ${b.timeSlot || "N/A"}\n` +
          `Type: ${b.type}\n` +
          `Booking ID: ${b.id}`,
        event: "booking_cancelled_client",
        refId: b.id,
      });
    } catch (e) {
      console.error("Client cancel notify failed:", e?.message || e);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/bookings/:id failed:", e?.message || e);
    res.status(500).json({ error: "Server error while cancelling booking" });
  }
});

// POST /api/bookings/:id/confirm -> confirm + write budget record
router.post("/:id/confirm", async (req, res) => {
  try {
    const bookings = readJson(BOOKINGS_PATH, []) || [];
    const b = bookings.find((x) => String(x.id) === String(req.params.id));
    if (!b) return res.status(404).json({ error: "Booking not found" });
    if (b.clientId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    if (b.status === "cancelled") return res.status(400).json({ error: "Booking cancelled" });

    b.status = "confirmed";
    b.confirmedAt = new Date().toISOString();
    writeJson(BOOKINGS_PATH, bookings);

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

    // Notify vendor
    if (b.vendorOwnerId) {
      try {
        const vendorUser = findUserById(b.vendorOwnerId);
        if (vendorUser?.email) {
          await notifyUser({
            toUserId: vendorUser.id,
            toEmail: vendorUser.email,
            toRole: "vendor",
            title: "Booking confirmed",
            message:
              `A client confirmed the booking ✅\n\n` +
              `Date: ${b.date}\n` +
              `Time: ${b.timeSlot || "N/A"}\n` +
              `Type: ${b.type}\n` +
              `Booking ID: ${b.id}`,
            event: "booking_confirmed",
            refId: b.id,
          });
        }
      } catch (e) {
        console.error("Vendor confirm notify failed:", e?.message || e);
      }
    }

    // Notify client
    try {
      const clientUser = findUserById(req.user.id);
      await notifyUser({
        toUserId: req.user.id,
        toEmail: clientUser?.email || null,
        toRole: "client",
        title: "Booking confirmed",
        message:
          `Your booking is confirmed ✅\n\n` +
          `Date: ${b.date}\n` +
          `Time: ${b.timeSlot || "N/A"}\n` +
          `Type: ${b.type}\n` +
          `Booking ID: ${b.id}\n\n` +
          `Recorded in budget: ${price} TND (${category}).`,
        event: "booking_confirmed_client",
        refId: b.id,
      });
    } catch (e) {
      console.error("Client confirm notify failed:", e?.message || e);
    }

    res.json({ ok: true, booking: b, budget });
  } catch (e) {
    console.error("POST /api/bookings/:id/confirm failed:", e?.message || e);
    res.status(500).json({ error: "Server error while confirming booking" });
  }
});

export default router;
