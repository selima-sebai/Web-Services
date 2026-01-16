import { apiGet, apiPatch } from "./api.js";
import { requireLogin } from "./authGate.js";

function main() {
  const u = requireLogin();
  if (!u) return;

  console.log("Notifications JS loaded");

  const listEl = document.getElementById("notifList");
  const refreshBtn = document.getElementById("refresh");
  const readAllBtn = document.getElementById("readAll");

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || "";
    }
  }

  function badge(read) {
    if (read) {
      return `<span class="badge" style="background:rgba(0,0,0,.05);color:var(--muted)">Read</span>`;
    }
    return `<span class="badge">New</span>`;
  }

  function render(items) {
    if (!items.length) {
      listEl.innerHTML = `<div class="item" style="grid-column: span 12;">No notifications yet.</div>`;
      return;
    }

    listEl.innerHTML = items
      .map((n) => {
        const emailInfo =
          n.delivery?.emailAttempted
            ? (n.delivery?.emailSent ? "📩 Email sent" : "📩 Email failed / not configured")
            : "";

        return `
          <div class="item" style="${n.read ? "opacity:.78" : ""}">
            <div class="row" style="justify-content:space-between;align-items:center;">
              <div>${badge(n.read)}</div>
              <div class="meta">${esc(formatTime(n.createdAt))}</div>
            </div>

            <h3 style="margin:10px 0 0 0;">${esc(n.title)}</h3>
            <div class="meta" style="margin-top:8px;white-space:pre-line;">${esc(n.message)}</div>

            <div class="meta" style="margin-top:10px;">${emailInfo}</div>

            ${
              n.read
                ? ""
                : `<div style="margin-top:12px;">
                     <button class="btn" data-id="${esc(n.id)}" data-action="read">Mark as read</button>
                   </div>`
            }
          </div>
        `;
      })
      .join("");

    document.querySelectorAll('button[data-action="read"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await apiPatch(`/notifications/${id}/read`, {});
          await load();
        } catch (e) {
          alert(e.message);
          btn.disabled = false;
        }
      });
    });
  }

  async function load() {
    try {
      const items = await apiGet("/notifications");
      render(items);
    } catch (e) {
      listEl.innerHTML = `<div class="item" style="grid-column: span 12;">Error: ${esc(e.message)}</div>`;
    }
  }

  refreshBtn?.addEventListener("click", load);

  readAllBtn?.addEventListener("click", async () => {
    readAllBtn.disabled = true;
    try {
      await apiPatch("/notifications/read-all/all", {});
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      readAllBtn.disabled = false;
    }
  });

  load();
}

main();
