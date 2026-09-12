import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Sinh số chứng từ tuần tự, không trùng (mục 43 spec: TRIP-202609-00001, PT-..., PC-..., BG-...).
 * Dùng transaction để tránh 2 người tạo cùng lúc bị trùng số.
 */
export async function getNextSequence(key: string): Promise<number> {
  const ref = doc(db, "number_sequences", key);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists() ? (snap.data().value as number) : 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
}

export async function getSequencePrefix(kind: "trip" | "receipt" | "payment" | "quote", fallback: string): Promise<string> {
  const snapshot = await getDoc(doc(db, "sequence_settings", kind));
  const prefix = snapshot.exists() ? snapshot.data().prefix : undefined;
  return typeof prefix === "string" && prefix.trim() ? prefix.trim() : fallback;
}
