

import {
  auth,
  db,
  ref,
  get,
  set
}
from "./firebase.js";
export let events      = load("events", []);
export let cats        = load("cats", []);
export let theme       = load("theme", "dark");
export let liveSession = load("liveSession", null);



function load(k, def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{return def;} }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }

async function saveCloud(){

  if(!window.auth.currentUser) return;

  const data = {
    events,
    cats,
    liveSession,
    theme
  };

 await set(
    ref(db, "users/" + auth.currentUser.uid + "/plannerData"),
    data
  );

}

async function loadCloud(){
  const snap = await get(
    ref(db, "users/" + auth.currentUser.uid + "/plannerData")
  );
  if(snap.exists()){
    const data = snap.val();
    events = data.events || [];
    cats   = data.cats   || [];
    theme  = data.theme  || "dark";
    liveSession = data.liveSession || null;
  }
}
export { saveCloud, loadCloud, load, save };
