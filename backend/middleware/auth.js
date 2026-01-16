// backend/middleware/auth.js
import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail clearly instead of silently using a wrong secret
    throw new Error("JWT_SECRET is not defined in backend/.env");
  }
  return secret;
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const [, token] = auth.split(" ");

  if (!token) return res.status(401).json({ error: "Missing Authorization token" });

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = payload; // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

