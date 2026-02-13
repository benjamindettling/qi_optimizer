import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Store everything in one doc: /users/{uid}
export async function loadAccountSettings(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  return data?.accountSettings ?? null;
}

export async function saveAccountSettings(uid, accountSettings) {
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      accountSettings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}