import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

function normalizeVendorName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove spaces & special chars
}

const DATA_DIR = path.join(process.cwd(), "Data");

const VENDORS_PATH = path.join(DATA_DIR, "vendors.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const VENDOR_PROFILES_PATH = path.join(DATA_DIR, "vendorProfiles.json");
const SERVICES_PATH = path.join(DATA_DIR, "services.json");
const BOOKINGS_PATH = path.join(DATA_DIR, "bookings.json");

function readJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

function safeStr(x) {
  return String(x ?? "").trim();
}

async function main() {
  const vendors = readJson(VENDORS_PATH, []);
  const users = readJson(USERS_PATH, []);
  const profiles = readJson(VENDOR_PROFILES_PATH, []);
  const services = readJson(SERVICES_PATH, []);
  const bookings = readJson(BOOKINGS_PATH, []);

  const createdCreds = [];

  for (const v of vendors) {
    // Skip already migrated
    if (v?.migrated) continue;

    const legacyId = String(v.id);

    // Create deterministic creds from vendor name
    let vendorKey = normalizeVendorName(v.name);

    // fallback if name becomes empty after normalization
    if (!vendorKey) vendorKey = `vendor${legacyId}`;

    // Avoid collisions if 2 vendors have the same normalized name
    let email = `${vendorKey}@gmail.com`;
    let suffix = 2;
    while (users.some((u) => u.email === email)) {
      // If the existing user is for THIS migrated vendorKey, we will just reuse it below
      // But if email taken by a different vendor, add suffix
      const existing = users.find((u) => u.email === email);
      if (existing) break;
      email = `${vendorKey}${suffix}@gmail.com`;
      suffix++;
    }

    const passwordPlain = `${vendorKey}123`;

    // Find or create vendor user
    let user = users.find((u) => u.email === email);
    if (!user) {
      const passwordHash = await bcrypt.hash(passwordPlain, 10);
      user = {
        id: uuid(),
        email,
        passwordHash,
        role: "vendor",
        createdAt: new Date().toISOString(),
      };
      users.push(user);

      // log only newly created vendor accounts
      console.log(`Vendor created: ${v.name} → ${email} / ${passwordPlain}`);
      createdCreds.push({ vendorName: v.name, email, password: passwordPlain });
    }

    // Create or find vendor profile
    let profile = profiles.find((p) => p.ownerId === user.id);
    if (!profile) {
      profile = {
        id: uuid(),
        ownerId: user.id,
        storeName: safeStr(v.name),
        region: safeStr(v.region) || "Unknown",
        description: safeStr(v.description),
        status: "approved", // keep same visibility as old vendors
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedFromVendorId: legacyId,
      };
      profiles.push(profile);
    }

    // Create a service representing this legacy listing
    let service = services.find(
      (s) => s.vendorProfileId === profile.id && String(s.migratedFromVendorId) === legacyId
    );

    if (!service) {
      const extra = [
        v.specialties ? `Specialties: ${JSON.stringify(v.specialties)}` : "",
        typeof v.homeService === "boolean" ? `Home service: ${v.homeService}` : "",
        v.durationMinutes ? `Duration: ${v.durationMinutes} min` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      service = {
        id: uuid(),
        vendorProfileId: profile.id,
        title: "", // keep display like old vendor name (storeName only)
        category: safeStr(v.category) || "other",
        price: Number(v.price) || 0,
        description: safeStr(v.description) + (extra ? `\n\n${extra}` : ""),
        timeSlots: Array.isArray(v.timeSlots) ? v.timeSlots.map(String) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedFromVendorId: legacyId,
      };
      services.push(service);
    }

    // Migrate bookings so vendor dashboard can see them
    for (const b of bookings) {
      if (String(b.vendorId) === legacyId) {
        b.vendorOwnerId = user.id;
        b.vendorProfileId = profile.id;
      }
    }

    // Mark legacy listing as migrated (so we can hide it from /api/vendors)
    v.migrated = true;
    v.migratedToServiceId = service.id;
    v.migratedToProfileId = profile.id;
    v.migratedToUserId = user.id;
  }

  // Write changes once at the end
  writeJson(USERS_PATH, users);
  writeJson(VENDOR_PROFILES_PATH, profiles);
  writeJson(SERVICES_PATH, services);
  writeJson(BOOKINGS_PATH, bookings);
  writeJson(VENDORS_PATH, vendors);

  console.log("✅ Migration complete.");

  if (createdCreds.length) {
    console.log("Created vendor logins (save these):");
    for (const c of createdCreds) {
      console.log(`- ${c.vendorName}: ${c.email} / ${c.password}`);
    }
  } else {
    console.log("No new vendor accounts were created (maybe you already ran the migration).");
  }
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
