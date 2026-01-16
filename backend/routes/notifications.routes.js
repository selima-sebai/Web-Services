import express from "express";
import { readJson, writeJson } from "../utils/fileDB.js";
import { NOTIFICATIONS_PATH } from "../lib/paths.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications -> my notifications
router.get("/", (req, res) => {
  const all = readJson(NOTIFICATIONS_PATH, []) || [];
  const mine = all.filter((n) => n.userId === req.user.id || n.email === req.user.email);
  res.json(mine);
});

// PATCH /api/notifications/:id/read -> mark read
router.patch("/:id/read", (req, res) => {
  const all = readJson(NOTIFICATIONS_PATH, []) || [];
  const idx = all.findIndex((n) => String(n.id) === String(req.params.id));
  if (idx < 0) return res.status(404).json({ error: "Notification not found" });

  const n = all[idx];
  const isMine = n.userId === req.user.id || n.email === req.user.email;
  if (!isMine) return res.status(403).json({ error: "Forbidden" });

  n.read = true;
  n.readAt = new Date().toISOString();
  all[idx] = n;
  writeJson(NOTIFICATIONS_PATH, all);

  res.json(n);
});

// PATCH /api/notifications/read-all/all -> mark all read
router.patch("/read-all/all", (req, res) => {
  const all = readJson(NOTIFICATIONS_PATH, []) || [];
  let changed = 0;

  for (const n of all) {
    const isMine = n.userId === req.user.id || n.email === req.user.email;
    if (isMine && !n.read) {
      n.read = true;
      n.readAt = new Date().toISOString();
      changed++;
    }
  }

  writeJson(NOTIFICATIONS_PATH, all);
  res.json({ ok: true, changed });
});

export default router;

