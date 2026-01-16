import { getUser, logout } from "./api.js";

const u = getUser();
const btn = document.getElementById("logoutBtn");

if (btn) {
  if (!u) {
    // hide logout if not logged in
    btn.style.display = "none";
  } else {
    btn.addEventListener("click", () => {
      logout();
      location.href = "./login.html";
    });
  }
}
