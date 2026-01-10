import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "../utils/fileDB.js";
import { requireAuth } from "../middleware/auth.js";
import { USERS_PATH } from "../lib/paths.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";
const ADMIN_REGISTRATION_KEY = process.env.ADMIN_REGISTRATION_KEY || "";

function sanitizeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

router.post("/register", async (req, res) => {
  const { email, password, role } = req.body || {};

  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const normalizedEmail = String(email).trim().toLowerCase();

  // allowed roles for normal users
  let userRole = "client";
  if (role === "vendor") userRole = "vendor";
  if (role === "admin") {
    // only allow admin creation if key matches
    if (!ADMIN_REGISTRATION_KEY || req.body.adminKey !== ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({ error: "Admin registration not allowed" });
    }
    userRole = "admin";
  }

  const users = readJson(USERS_PATH, []);
  if (users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = {
    id: uuid(),
    email: normalizedEmail,
    passwordHash,
    role: userRole,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeJson(USERS_PATH, users);

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const normalizedEmail = String(email).trim().toLowerCase();

  const users = readJson(USERS_PATH, []);
  const user = users.find((u) => u.email === normalizedEmail);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
