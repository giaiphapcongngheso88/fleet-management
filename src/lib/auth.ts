import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseApp } from "./firebase";
import { Role } from "@/utils/permissions";

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutUser() {
  await signOut(auth);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Tạo user mới (màn hình Hệ thống > Người dùng) mà KHÔNG làm mất phiên đăng nhập
 * của admin hiện tại — createUserWithEmailAndPassword mặc định sẽ tự đăng nhập vào
 * user vừa tạo trên cùng app instance, nên phải tạo trên 1 app Firebase phụ dùng
 * xong rồi huỷ ngay.
 */
export async function adminCreateUser(params: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: Role;
  createdBy: string;
}) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, params.email, params.password);
    await setDoc(doc(db, "users", cred.user.uid), {
      email: params.email,
      fullName: params.fullName,
      phone: params.phone ?? "",
      role: params.role,
      status: "ACTIVE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
    });
    await signOut(secondaryAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function changeOwnPassword(newPassword: string) {
  if (!auth.currentUser) throw new Error("Chưa đăng nhập");
  await updatePassword(auth.currentUser, newPassword);
}

export { firebaseApp };
