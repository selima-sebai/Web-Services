import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readJson } from "../utils/fileDB.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve traditions.json relative to this file (NOT where node was launched)
const traditionsPath = path.join(__dirname, "..", "Data", "traditions.json");

// Turn image paths into absolute URLs so they work from any frontend origin
function normalizeTradition(req, t) {
  const host = `${req.protocol}://${req.get("host")}`; // e.g. http://localhost:3000

  const images = Array.isArray(t.images) ? t.images : [];
  const normalizedImages = images
    .filter(Boolean)
    .map((src) => {
      // Already absolute
      if (src.startsWith("http://") || src.startsWith("https://")) return src;

      // "/traditions/x.jpg" -> "http://localhost:3000/traditions/x.jpg"
      if (src.startsWith("/")) return host + src;

      // "./traditions/x.jpg" or "traditions/x.jpg" -> absolute
      const clean = src.replace(/^\.\//, "");
      return `${host}/${clean}`;
    });

  return { ...t, images: normalizedImages };
}

// GET /api/traditions
router.get("/", (req, res) => {
  let traditions;
  try {
    traditions = readJson(traditionsPath);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to read traditions data",
      details: err.message,
    });
  }

  const { region } = req.query;

  let results = traditions;
  if (region) {
    results = traditions.filter(
      (t) => t.region && t.region.toLowerCase() === region.toLowerCase()
    );
  }

  res.json(results.map((t) => normalizeTradition(req, t)));
});

// GET /api/traditions/:id
router.get("/:id", (req, res) => {
  let traditions;
  try {
    traditions = readJson(traditionsPath);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to read traditions data",
      details: err.message,
    });
  }

  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid tradition id" });

  const item = traditions.find((t) => t.id === id);
  if (!item) return res.status(404).json({ error: "Tradition not found" });

  res.json(normalizeTradition(req, item));
});

export default router;
