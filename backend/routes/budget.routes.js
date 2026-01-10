import express from "express";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth } from "../middleware/auth.js";
import { BUDGETS_PATH } from "../lib/paths.js";

const router = express.Router();

function getOrCreate(clientId) {
  const budgets = readJson(BUDGETS_PATH, []) || [];
  let b = budgets.find((x) => x.clientId === clientId);
  if (!b) {
    b = { clientId, total: 0, allocations: {}, actuals: {}, records: [], updatedAt: new Date().toISOString() };
    budgets.push(b);
    writeJson(BUDGETS_PATH, budgets);
  }
  return b;
}

function save(budget) {
  const budgets = readJson(BUDGETS_PATH, []) || [];
  const idx = budgets.findIndex((x) => x.clientId === budget.clientId);
  budget.updatedAt = new Date().toISOString();
  if (idx >= 0) budgets[idx] = budget;
  else budgets.push(budget);
  writeJson(BUDGETS_PATH, budgets);
}

router.get("/", requireAuth, (req, res) => {
  res.json(getOrCreate(req.user.id));
});

router.put("/", requireAuth, (req, res) => {
  const b = getOrCreate(req.user.id);
  const { total, allocations, actuals } = req.body || {};

  if (typeof total === "number") b.total = total;
  if (allocations && typeof allocations === "object") b.allocations = { ...(b.allocations || {}), ...allocations };
  if (actuals && typeof actuals === "object") b.actuals = { ...(b.actuals || {}), ...actuals };

  save(b);
  res.json(b);
});

router.post("/record", requireAuth, (req, res) => {
  const b = getOrCreate(req.user.id);
  const { category, amount, date } = req.body || {};

  if (!category || typeof amount !== "number") return res.status(400).json({ error: "category and numeric amount required" });

  b.actuals[category] = (b.actuals[category] || 0) + amount;
  b.records.unshift({
    id: uuid(),
    date: date || new Date().toISOString().slice(0, 10),
    category,
    amount,
  });

  save(b);
  res.json(b);
});

export default router;
