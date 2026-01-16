// backend/utils/mailer.js
import { addNotification } from "./notifications.js";

const APP_NAME = process.env.APP_NAME || "eersi.tn";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";

const emailEnabled = Boolean(RESEND_API_KEY && RESEND_FROM);

// Lazy-loaded resend client (prevents backend from crashing if resend can't load)
let _resend = null;

function subjectLine(title) {
  return `${APP_NAME} — ${title}`;
}

async function getResendClient() {
  if (!emailEnabled) return null;
  if (_resend) return _resend;

  try {
    // dynamic import so older Node / missing deps won't crash the whole backend
    const mod = await import("resend");
    const Resend = mod.Resend || mod.default?.Resend || mod.default;
    _resend = new Resend(RESEND_API_KEY);
    return _resend;
  } catch (err) {
    console.error("❌ Failed to load Resend SDK. Email disabled.", err?.message || err);
    return null;
  }
}

async function sendEmail({ to, subject, text }) {
  // If no email provided, skip sending but keep in-app notifications.
  if (!to || typeof to !== "string") return { attempted: false, sent: false };

  if (!emailEnabled) {
    console.log("📧 (DEV) Resend not configured, email skipped:", { to, subject });
    return { attempted: true, sent: false };
  }

  const resend = await getResendClient();
  if (!resend) {
    // provider unavailable -> do not break app flow
    return { attempted: true, sent: false };
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject: subject || `${APP_NAME} Notification`,
      text: text || "",
    });
    return { attempted: true, sent: true };
  } catch (err) {
    console.error("❌ Resend error:", err?.message || err);
    return { attempted: true, sent: false };
  }
}

/**
 * notifyUser
 * - ALWAYS creates an in-app notification (Data/notifications.json)
 * - Tries to send an email if configured
 * - Never throws (won't break booking/admin/vendor flows)
 */
export async function notifyUser({
  toUserId,
  toEmail,
  toRole,
  title,
  message,
  event = "general",
  refId = null,
  meta = {},
}) {
  const safeEmail = typeof toEmail === "string" && toEmail.trim() ? toEmail.trim() : null;

  const delivery = await sendEmail({
    to: safeEmail,
    subject: subjectLine(title),
    text: message,
  });

  try {
    return addNotification({
      userId: toUserId,
      email: safeEmail,
      role: toRole,
      title,
      message: String(message || ""),
      event,
      refId,
      meta,
      delivery: {
        emailAttempted: delivery.attempted,
        emailSent: delivery.sent,
        provider: "resend",
      },
    });
  } catch (err) {
    console.error("❌ addNotification failed:", err?.message || err);
    return null;
  }
}

