import express from "express";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { VENDOR_PROFILES_PATH, USERS_PATH } from "../lib/paths.js";
import { notifyUser } from "../utils/mailer.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

function findUserById(userId) {
  const users = readJson(USERS_PATH, []) || [];
  return users.find((u) => String(u.id) === String(userId)) || null;
}

router.get("/vendors/pending", (req, res) => {
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  res.json(profiles.filter((p) => p.status === "pending"));
});

router.patch("/vendors/:id/approve", async (req, res) => {
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  const idx = profiles.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Vendor profile not found" });

  profiles[idx].status = "approved";
  profiles[idx].updatedAt = new Date().toISOString();
  writeJson(VENDOR_PROFILES_PATH, profiles);

  const vendorUser = findUserById(profiles[idx].ownerId);
  if (vendorUser?.email) {
    await notifyUser({
      toUserId: vendorUser.id,
      toEmail: vendorUser.email,
      toRole: "vendor",
      title: "Vendor application approved",
      message:
        `Congratulations! Your vendor application has been approved ✅\n\n` +
        `Store: ${profiles[idx].storeName}\n` +
        `Region: ${profiles[idx].region}\n\n` +
        `You can now add services and receive bookings.`,
      event: "vendor_approved",
      refId: profiles[idx].id,
    });
  }

  res.json(profiles[idx]);
});

router.patch("/vendors/:id/reject", async (req, res) => {
  const profiles = readJson(VENDOR_PROFILES_PATH, []) || [];
  const idx = profiles.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Vendor profile not found" });

  profiles[idx].status = "rejected";
  profiles[idx].updatedAt = new Date().toISOString();
  writeJson(VENDOR_PROFILES_PATH, profiles);

  const vendorUser = findUserById(profiles[idx].ownerId);
  if (vendorUser?.email) {
    await notifyUser({
      toUserId: vendorUser.id,
      toEmail: vendorUser.email,
      toRole: "vendor",
      title: "Vendor application rejected",
      message:
        `Your vendor application was rejected ❌\n\n` +
        `Store: ${profiles[idx].storeName}\n` +
        `Region: ${profiles[idx].region}\n\n` +
        `Update your info and re-apply from Vendor Dashboard.`,
      event: "vendor_rejected",
      refId: profiles[idx].id,
    });
  }

  res.json(profiles[idx]);
});

// optional: list users (safe fields)
router.get("/users", (req, res) => {
  const users = readJson(USERS_PATH, []) || [];
  res.json(users.map(({ passwordHash, ...safe }) => safe));
});

export default router;


