import { apiGet, apiPost, apiPut } from "./api.js";

const totalInput = document.getElementById("totalInput");
const saveTotalBtn = document.getElementById("saveTotal");
const summaryEl = document.getElementById("summary");
const allocationsEl = document.getElementById("allocations");
const allocCategory = document.getElementById("allocCategory");
const allocAmount = document.getElementById("allocAmount");
const addAllocBtn = document.getElementById("addAlloc");
const recordsEl = document.getElementById("records");

async function load() {
  try {
    let budget;
    // load budget from backend API (API-only)
    budget = await apiGet("/budget");

    totalInput.value = budget.total || 0;

    // summary
    const totalAllocated = Object.values(budget.allocations || {}).reduce(
      (s, v) => s + (v || 0),
      0
    );
    const totalActual = Object.values(budget.actuals || {}).reduce(
      (s, v) => s + (v || 0),
      0
    );
    const remainingUnallocated = (budget.total || 0) - totalAllocated; // budget left that hasn't been allocated
    const remainingOverall = (budget.total || 0) - totalActual; // total minus actual spending
    summaryEl.innerHTML = `<div>Total: ${budget.total || 0}</div><div>Allocated: ${totalAllocated}</div><div>Actual spent: ${totalActual}</div><div>Remaining (unallocated): ${remainingUnallocated}</div><div>Remaining (overall): ${remainingOverall}</div>`;

    // allocations
    allocationsEl.innerHTML = Object.keys(budget.allocations || {}).length
      ? `<table style="width:100%"><tr><th>Category</th><th>Alloc</th><th>Actual</th><th>Remaining</th></tr>` +
        Object.keys(budget.allocations)
          .map((k) => {
            const alloc = budget.allocations[k] || 0;
            const actual = (budget.actuals && budget.actuals[k]) || 0;
            return `<tr><td>${k}</td><td>${alloc}</td><td>${actual}</td><td>${
              alloc - actual
            }</td></tr>`;
          })
          .join("") +
        `</table>`
      : `<div>No allocations defined.</div>`;

    // records
    recordsEl.innerHTML = (budget.records || []).length
      ? `<ul>` +
        (budget.records || [])
          .map(
            (r) =>
              `<li>${r.date} — ${r.category}: ${r.amount} ${
                r.bookingId ? "(booking #" + r.bookingId + ")" : ""
              }</li>`
          )
          .join("") +
        `</ul>`
      : `<div>No records</div>`;
  } catch (err) {
    summaryEl.textContent = "Error loading budget: " + err.message;
  }
}

async function putBudget(data) {
  // use apiPut helper to update budget via backend
  return apiPut("/budget", data);
}

saveTotalBtn.addEventListener("click", async () => {
  const val = Number(totalInput.value) || 0;
  try {
    await putBudget({ total: val });
    await load();
  } catch (err) {
    alert(err.message);
  }
});

addAllocBtn.addEventListener("click", async () => {
  const cat = (allocCategory.value || "").trim();
  const amt = Number(allocAmount.value);
  if (!cat || Number.isNaN(amt)) return alert("Enter category and numeric amount");
  try {
    await putBudget({ allocations: { [cat]: amt } });
    allocCategory.value = "";
    allocAmount.value = "";
    await load();
  } catch (err) {
    alert(err.message);
  }
});

load();
