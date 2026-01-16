import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "Data");

const BOOKINGS_PATH = path.join(DATA_DIR, "bookings.json");
const VENDORS_PATH = path.join(DATA_DIR, "vendors.json"); // legacy vendors
const SERVICES_PATH = path.join(DATA_DIR, "services.json"); // new services

function readJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

function isLegacyVendorId(vendorId) {
  return typeof vendorId === "number" || (typeof vendorId === "string" && /^\d+$/.test(vendorId));
}

async function main() {
  const bookings = readJson(BOOKINGS_PATH, []);
  const legacyVendors = readJson(VENDORS_PATH, []);
  const services = readJson(SERVICES_PATH, []);

  // Build a map: legacyVendorId -> serviceId
  // We use service.migratedFromVendorId (set during your vendor migration)
  const legacyToService = {};
  for (const s of services) {
    if (s.migratedFromVendorId != null) {
      legacyToService[String(s.migratedFromVendorId)] = s.id;
    }
  }

  let changed = 0;
  let skipped = 0;

  for (const b of bookings) {
    if (!isLegacyVendorId(b.vendorId)) continue;

    const legacyId = String(b.vendorId);
    const newServiceId = legacyToService[legacyId];

    if (!newServiceId) {
      // Could not resolve (maybe vendor not migrated)
      skipped++;
      continue;
    }

    // Update booking to point to service UUID
    b.vendorId = newServiceId;
    changed++;
  }

  writeJson(BOOKINGS_PATH, bookings);

  console.log("✅ Booking vendorId migration finished.");
  console.log(`Updated bookings: ${changed}`);
  console.log(`Skipped (no matching service): ${skipped}`);

  if (skipped > 0) {
    console.log("Tip: skipped bookings mean some legacy vendor ids do not have migrated services yet.");
  }
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
