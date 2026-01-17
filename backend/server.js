// backend/server.js
import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import vendorsRoutes from "./routes/vendors.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import traditionsRoutes from "./routes/traditions.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();

const corsOptions = {
  origin: true, // allow all origins
  credentials: true, // allow credentials (e.g., Authorization header)
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// ✅ Preflight handler (Express 5 safe, no "*" patterns)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// static assets
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// APIs
app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/traditions", traditionsRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/notifications", notificationsRoutes);

// Role portals
app.use("/api/vendor", vendorRoutes);
app.use("/api/admin", adminRoutes);

// helpful API 404
app.use("/api", (req, res) => res.status(404).json({ error: "API route not found" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));