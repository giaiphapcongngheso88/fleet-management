import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SequenceKind, SequenceSetting } from "@/types/sequence-settings";

const defaults: Record<SequenceKind, { prefix: string; nextNumber: number }> = {
  trip: { prefix: "TRIP", nextNumber: 1 },
  receipt: { prefix: "PT", nextNumber: 1 },
  payment: { prefix: "PC", nextNumber: 1 },
  quote: { prefix: "BG", nextNumber: 1 },
};

export async function getSequenceSettings(): Promise<SequenceSetting[]> {
  return Promise.all((Object.keys(defaults) as SequenceKind[]).map(async (key) => {
    const snapshot = await getDoc(doc(db, "sequence_settings", key));
    return { id: key, key, ...(snapshot.exists() ? snapshot.data() : defaults[key]), status: "ACTIVE" } as SequenceSetting;
  }));
}

export async function saveSequenceSetting(setting: Pick<SequenceSetting, "key" | "prefix" | "nextNumber">, userId: string): Promise<void> {
  await setDoc(doc(db, "sequence_settings", setting.key), { ...setting, updatedBy: userId, updatedAt: new Date() }, { merge: true });
}
