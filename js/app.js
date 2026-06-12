import { auth, db, ref, get, set, onAuthStateChanged }
  from "./firebase.js";

import { loadCloud } from "./storage.js";
import { render } from "./ui.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }
  await loadCloud();
  render();
});
