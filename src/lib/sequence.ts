import { doc, runTransaction } from "firebase/firestore";
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
