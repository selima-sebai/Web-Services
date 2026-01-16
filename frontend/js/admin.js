import { apiGet, apiPatch, logout } from "./api.js";
import { requireRole } from "./authGate.js";

const u = requireRole("admin");
if (!u) {
  // requireRole already redirected
  throw new Error("Not authorized");
}

document.getElementById("who").textContent = `Logged in as: ${u.email}`;

document.getElementById("logout").addEventListener("click", () => {
  logout();
  location.href = "./login.html";
});

const pending = document.getElementById("pending");

async function load() {
  const items = await apiGet("/admin/vendors/pending");

  if (!items.length) {
    pending.innerHTML = `<div class="meta">No pending vendors.</div>`;
    return;
  }

  pending.innerHTML = items
    .map(
      (v) => `
      <div class="item">
        <div style="font-weight:800">${v.storeName}</div>
        <div class="meta">${v.region}</div>
        <div class="meta">${v.description || ""}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn" data-id="${v.id}" data-action="approve">Approve</button>
          <button class="btn" data-id="${v.id}" data-action="reject">Reject</button>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      try {
        await apiPatch(`/admin/vendors/${id}/${action}`, {});
        await load();
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
      }
    });
  });
}

load().catch((e) => {
  pending.innerHTML = `<div class="meta">Error: ${e.message}</div>`;
});
