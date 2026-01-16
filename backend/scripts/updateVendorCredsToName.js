import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "Data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const PROFILES_PATH = path.join(DATA_DIR, "vendorProfiles.json");

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

function normalizeVendorName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const users = readJson(USERS_PATH, []);
  const profiles = readJson(PROFILES_PATH, []);

  // Track emails already used to avoid duplicates
  const usedEmails = new Set(users.map((u) => String(u.email).toLowerCase()));

  const updated = [];

  for (const p of profiles) {
    // Update only migrated vendors (safe)
    if (!p.migratedFromVendorId) continue;

    const user = users.find((u) => u.id === p.ownerId);
    if (!user) continue;
    if (user.role !== "vendor") continue;

    let base = normalizeVendorName(p.storeName);
    if (!base) base = `vendor${String(p.id).slice(0, 6)}`;

    // New desired creds
    let newEmail = `${base}@gmail.com`;
    let i = 2;

    // If email is taken by someone else, add suffix
    while (
      usedEmails.has(newEmail.toLowerCase()) &&
      String(user.email).toLowerCase() !== newEmail.toLowerCase()
    ) {
      newEmail = `${base}${i}@gmail.com`;
      i++;
    }

    const newPasswordPlain = `${base}123`;
    const newPasswordHash = await bcrypt.hash(newPasswordPlain, 10);

    // Update tracking set
    usedEmails.delete(String(user.email).toLowerCase());
    usedEmails.add(newEmail.toLowerCase());

    // Apply changes
    user.email = newEmail;
    user.passwordHash = newPasswordHash;

    updated.push({
      storeName: p.storeName,
      email: newEmail,
      password: newPasswordPlain,
    });
  }

  writeJson(USERS_PATH, users);

  console.log("✅ Vendor credentials updated.");
  console.log("Use these logins:");
  for (const x of updated) {
    console.log(`- ${x.storeName}: ${x.email} / ${x.password}`);
  }

  if (!updated.length) {
    console.log(
      "⚠️ No vendors updated. If your profiles don't have migratedFromVendorId, tell me and I’ll adjust the script."
    );
  }
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
