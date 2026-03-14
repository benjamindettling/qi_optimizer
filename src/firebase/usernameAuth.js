// src/firebase/usernameAuth.js
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const normalize = (s) => (s ?? "").trim().toLowerCase();
const normalizeRaw = (s) => (s ?? "").trim();

// -----------------------------
// LOGIN: username OR email
// -----------------------------
export async function loginWithUsernameOrEmail(identifier, password) {
  const input = (identifier ?? "").trim();

  // Email login
  if (input.includes("@")) {
    return signInWithEmailAndPassword(auth, input, password);
  }

  // Username login via index doc usernames/{uname}
  const uname = normalize(input);
  if (!uname) {
    const err = new Error("Benutzername nicht gefunden");
    err.code = "USERNAME_NOT_FOUND";
    throw err;
  }

  const ref = doc(db, "usernames", uname);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const err = new Error("Benutzername nicht gefunden");
    err.code = "USERNAME_NOT_FOUND";
    throw err;
  }

  const data = snap.data();
  const email = data?.email;
  if (!email) {
    throw new Error("Username-Index ist unvollständig (email fehlt).");
  }

  return signInWithEmailAndPassword(auth, email, password);
}

// -----------------------------
// CLAIM: first-time username
// -----------------------------
// src/firebase/usernameAuth.js
export async function claimUsername(uid, username, email) {
  const usernameRaw = normalizeRaw(username);
  const uname = normalize(usernameRaw);
  if (!uname || !usernameRaw) throw new Error("Username darf nicht leer sein.");

  const unameRef = doc(db, "usernames", uname);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(unameRef);
    if (existing.exists()) {
      const err = new Error("Benutzername ist bereits vergeben");
      err.code = "USERNAME_TAKEN";
      throw err;
    }

    // create index
    tx.set(unameRef, {
      uid,
      email: email ?? null,
      createdAt: serverTimestamp(),
    });

    // set canonical username on profile
    tx.set(
      userRef,
      { username: usernameRaw, usernameUpdatedAt: serverTimestamp() },
      { merge: true }
    );
  });
}

// -----------------------------
// RENAME: editable username
// Atomic: create new index, delete old index, update users/{uid}.username
// -----------------------------
export async function changeUsername({ uid, email, oldUsername, newUsername }) {
  const oldU = normalize(oldUsername);
  const newRaw = normalizeRaw(newUsername);
  const newU = normalize(newRaw);

  if (!newU || !newRaw) throw new Error("Username darf nicht leer sein.");
  if (newU === oldU) return;

  const newRef = doc(db, "usernames", newU);
  const oldRef = oldU ? doc(db, "usernames", oldU) : null;
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (tx) => {
    // ALL READS FIRST (Firestore requirement)
    const newSnap = await tx.get(newRef);
    const oldSnap = oldRef ? await tx.get(oldRef) : null;

    // Validate: new username must be free
    if (newSnap.exists()) {
      const err = new Error("Benutzername ist bereits vergeben");
      err.code = "USERNAME_TAKEN";
      throw err;
    }

    // ALL WRITES AFTER READS
    // 1) create new index
    tx.set(newRef, {
      uid,
      email: email ?? null,
      createdAt: serverTimestamp(),
    });

    // 2) delete old index if owned
    if (oldRef && oldSnap?.exists() && oldSnap.data()?.uid === uid) {
      tx.delete(oldRef);
    }

    // 3) update canonical username
    tx.set(
      userRef,
      { username: newRaw, usernameUpdatedAt: serverTimestamp() },
      { merge: true }
    );
  });
}

// -----------------------------
// READ canonical username
// -----------------------------
export async function fetchProfileUsername(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "";
  return snap.data()?.username ?? "";
}