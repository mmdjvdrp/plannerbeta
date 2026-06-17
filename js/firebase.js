import { initializeApp }

from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update
}
from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUtA25o7-msDMiWOxtW21FTVJM_fQoRc0",
  authDomain: "planner-751c1.firebaseapp.com",
  databaseURL: "https://planner-751c1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planner-751c1",
  storageBucket: "planner-751c1.firebasestorage.app",
  messagingSenderId: "324667244818",
  appId: "1:324667244818:web:d1116c357fac5cc58d33cb",
  measurementId: "G-161ZWGC962"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

export {
  ref,
  get,
  set,
  update,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
