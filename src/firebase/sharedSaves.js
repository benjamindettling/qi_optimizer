import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

function normalizeTitle(title) {
  return String(title ?? "").trim();
}

function normalizeTitleLower(title) {
  return normalizeTitle(title).toLowerCase();
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildSharedSaveDocuments({ saveEntry, ownerUid, ownerUsername, title }) {
  const cleanTitle = normalizeTitle(title);
  if (!cleanTitle) {
    throw new Error("Save title must not be empty.");
  }

  const stats = saveEntry?.stats ?? {};
  const minimum = stats.minimum ?? {};
  const final = stats.final ?? {};

  const metadata = {
    ownerUid,
    ownerUsername: String(ownerUsername ?? ""),
    title: cleanTitle,
    titleLower: cleanTitle.toLowerCase(),

    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    saveVersion: toFiniteNumber(saveEntry?.version, 2),
    isPublic: true,

    minMoney: toFiniteNumber(minimum.money),
    minSupplies: toFiniteNumber(minimum.supplies),
    minGoods: toFiniteNumber(minimum.goods),
    minShardsUsed: toFiniteNumber(minimum.shardsUsed),

    finalAttack: toFiniteNumber(final.attack),
    finalDefense: toFiniteNumber(final.defense),
    finalTotalQaSetup: toFiniteNumber(final.totalQaSetup),
    finalUnitKatapult: toFiniteNumber(final.units?.Katapult),
    finalUnitBlide: toFiniteNumber(final.units?.Blide),
    finalUnitKanone: toFiniteNumber(final.units?.Kanone),
  };

  const exportedSave = {
    version: toFiniteNumber(saveEntry?.version, 2),
    name: cleanTitle,
    tree: saveEntry?.tree ?? null,
    ...(saveEntry?.stats ? { stats: saveEntry.stats } : {}),
  };

  const payload = {
    ownerUid,
    version: exportedSave.version,
    name: cleanTitle,
    json: JSON.stringify(exportedSave),
  };

  return { metadata, payload };
}

export async function findOwnSharedSaveByTitle({ ownerUid, title }) {
  const cleanLower = normalizeTitleLower(title);
  if (!ownerUid || !cleanLower) return null;

  const q = query(
    collection(db, "sharedSaves"),
    where("ownerUid", "==", ownerUid),
    where("titleLower", "==", cleanLower),
    where("isPublic", "==", true),
    limit(1),
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return {
    id: first.id,
    ...first.data(),
  };
}

export async function uploadSharedSave({ saveEntry, ownerUid, ownerUsername, title }) {
  if (!ownerUid) throw new Error("Missing ownerUid.");

  const { metadata, payload } = buildSharedSaveDocuments({
    saveEntry,
    ownerUid,
    ownerUsername,
    title,
  });

  const metaRef = doc(collection(db, "sharedSaves"));
  const payloadRef = doc(db, "sharedSaves", metaRef.id, "data", "content");

  const batch = writeBatch(db);
  batch.set(metaRef, metadata);
  batch.set(payloadRef, payload);

  await batch.commit();

  return metaRef.id;
}

export async function overwriteSharedSave({
  saveId,
  saveEntry,
  ownerUid,
  ownerUsername,
  title,
}) {
  if (!saveId) throw new Error("Missing saveId.");
  if (!ownerUid) throw new Error("Missing ownerUid.");

  const { metadata, payload } = buildSharedSaveDocuments({
    saveEntry,
    ownerUid,
    ownerUsername,
    title,
  });

  const metaRef = doc(db, "sharedSaves", saveId);
  const payloadRef = doc(db, "sharedSaves", saveId, "data", "content");

  const existingMetaSnap = await getDoc(metaRef);
  if (!existingMetaSnap.exists()) {
    throw new Error("Shared save not found.");
  }

  const existingMeta = existingMetaSnap.data();
  if (existingMeta.ownerUid !== ownerUid) {
    throw new Error("You are not allowed to overwrite this save.");
  }

  const batch = writeBatch(db);
  batch.set(metaRef, {
    ...metadata,
    uploadedAt: existingMeta.uploadedAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(payloadRef, payload);

  await batch.commit();
}

export async function renameSharedSave({ saveId, ownerUid, newTitle }) {
  const cleanTitle = normalizeTitle(newTitle);
  if (!saveId) throw new Error("Missing saveId.");
  if (!ownerUid) throw new Error("Missing ownerUid.");
  if (!cleanTitle) throw new Error("New title must not be empty.");

  const metaRef = doc(db, "sharedSaves", saveId);
  const payloadRef = doc(db, "sharedSaves", saveId, "data", "content");

  const metaSnap = await getDoc(metaRef);
  if (!metaSnap.exists()) throw new Error("Shared save not found.");

  const meta = metaSnap.data();
  if (meta.ownerUid !== ownerUid) {
    throw new Error("You are not allowed to rename this save.");
  }

  const payloadSnap = await getDoc(payloadRef);
  if (!payloadSnap.exists()) throw new Error("Shared save payload not found.");

  const payloadData = payloadSnap.data();
  let parsedJson = null;

  try {
    parsedJson = JSON.parse(payloadData.json);
  } catch {
    throw new Error("Shared save payload is corrupted.");
  }

  parsedJson.name = cleanTitle;

  const batch = writeBatch(db);
  batch.update(metaRef, {
    title: cleanTitle,
    titleLower: cleanTitle.toLowerCase(),
    updatedAt: serverTimestamp(),
  });
  batch.update(payloadRef, {
    name: cleanTitle,
    json: JSON.stringify(parsedJson),
  });

  await batch.commit();
}

export async function deleteSharedSave({ saveId, ownerUid }) {
  if (!saveId) throw new Error("Missing saveId.");
  if (!ownerUid) throw new Error("Missing ownerUid.");

  const metaRef = doc(db, "sharedSaves", saveId);
  const payloadRef = doc(db, "sharedSaves", saveId, "data", "content");

  const metaSnap = await getDoc(metaRef);
  if (!metaSnap.exists()) return;

  const meta = metaSnap.data();
  if (meta.ownerUid !== ownerUid) {
    throw new Error("You are not allowed to delete this save.");
  }

  const batch = writeBatch(db);
  batch.delete(payloadRef);
  batch.delete(metaRef);

  await batch.commit();
}

export async function downloadSharedSave(saveId) {
  if (!saveId) throw new Error("Missing saveId.");

  const payloadRef = doc(db, "sharedSaves", saveId, "data", "content");
  const payloadSnap = await getDoc(payloadRef);

  if (!payloadSnap.exists()) {
    throw new Error("Shared save payload not found.");
  }

  const payload = payloadSnap.data();

  if (typeof payload.json !== "string") {
    throw new Error("Shared save payload is invalid.");
  }

  return JSON.parse(payload.json);
}

export async function listNewestSharedSaves(pageSize = 25) {
  const q = query(
    collection(db, "sharedSaves"),
    where("isPublic", "==", true),
    orderBy("uploadedAt", "desc"),
    limit(pageSize),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function syncOwnerUsernameOnSharedSaves({ ownerUid, newUsername }) {
  if (!ownerUid) throw new Error("Missing ownerUid.");

  const q = query(
    collection(db, "sharedSaves"),
    where("ownerUid", "==", ownerUid),
  );

  const snap = await getDocs(q);
  if (snap.empty) return 0;

  let updated = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const sharedSaveDoc of snap.docs) {
    batch.update(sharedSaveDoc.ref, {
      ownerUsername: String(newUsername ?? ""),
      updatedAt: serverTimestamp(),
    });
    ops += 1;
    updated += 1;

    if (ops === 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  return updated;
}

// ---------------------------------------------------------------------
// LIST all public saves by a specific user
// ---------------------------------------------------------------------
export async function listSharedSavesByUser(ownerUid) {
  if (!ownerUid) return [];

  const q = query(
    collection(db, "sharedSaves"),
    where("ownerUid", "==", ownerUid),
    where("isPublic", "==", true),
    orderBy("uploadedAt", "desc"),
    limit(200),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

// ---------------------------------------------------------------------
// PROFILE DESCRIPTION — read/write users/{uid}.profileDescription
// ---------------------------------------------------------------------
export async function getProfileDescription(uid) {
  if (!uid) return "";
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "";
  return snap.data()?.profileDescription ?? "";
}

export async function setProfileDescription(uid, description) {
  if (!uid) throw new Error("Missing uid.");
  const text = String(description ?? "").trim().slice(0, 500);
  await setDoc(
    doc(db, "users", uid),
    { profileDescription: text, profileDescUpdatedAt: serverTimestamp() },
    { merge: true },
  );
}