import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser } from "@/types/user";
import { EntityStatus } from "@/types/common";
import { Role } from "@/utils/permissions";

const col = collection(db, "users");

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(col, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser);
}

export async function updateUserProfile(
  id: string,
  data: { fullName: string; phone?: string; role: Role },
  updatedBy: string
): Promise<void> {
  await updateDoc(doc(db, "users", id), { ...data, updatedAt: serverTimestamp(), updatedBy });
}

export async function setUserStatus(id: string, status: EntityStatus, updatedBy: string): Promise<void> {
  await updateDoc(doc(db, "users", id), { status, updatedAt: serverTimestamp(), updatedBy });
}
