import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.join(__dirname, "..", "Data");

export const USERS_PATH = path.join(DATA_DIR, "users.json");
export const VENDOR_PROFILES_PATH = path.join(DATA_DIR, "vendorProfiles.json");
export const SERVICES_PATH = path.join(DATA_DIR, "services.json");
export const BOOKINGS_PATH = path.join(DATA_DIR, "bookings.json");
export const BUDGETS_PATH = path.join(DATA_DIR, "budgets.json");
export const LEGACY_VENDORS_PATH = path.join(DATA_DIR, "vendors.json");
export const TRADITIONS_PATH = path.join(DATA_DIR, "traditions.json");
export const NOTIFICATIONS_PATH = path.join(DATA_DIR, "notifications.json");
