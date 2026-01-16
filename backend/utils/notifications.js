import { v4 as uuid } from "uuid";
import { readJson, writeJson } from "./fileDB.js";
import { NOTIFICATIONS_PATH } from "../lib/paths.js";

/**
 * Adds an in-app notification.
 * Stored in Data/notifications.json
 */
export function addNotification({
  userId,
  email,
  role,
  title,
  message,
  event = "general",
  refId = null,
  meta = {},
  delivery = { emailAttempted: false, emailSent: false },
}) {
  const items = readJson(NOTIFICATIONS_PATH, []) || [];

  const n = {
    id: uuid(),
    userId: userId || null,
    email: email || null,
    role: role || null,
    title: String(title || "Notification"),
    message: String(message || ""),
    event,
    refId,
    meta,
    delivery,
    read: false,
    createdAt: new Date().toISOString(),
  };

  // newest first
  items.unshift(n);
  writeJson(NOTIFICATIONS_PATH, items);
  return n;
}
