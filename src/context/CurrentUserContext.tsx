"use client";

import { auth, db } from "@/lib/firebase";
import { Role } from "@/utils/permissions";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  avatarUrl?: string | null;
};

type CurrentUserContextType = {
  firebaseUser: FirebaseUser | null;
  user: CurrentUser | null;
  /** true trong lúc đang xác định trạng thái đăng nhập lần đầu (tránh nháy màn hình). */
  isLoading: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthResolved(true);
      if (!fbUser) {
        setUser(null);
        setProfileResolved(true);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setProfileResolved(false);
    const unsubProfile = onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUser({
            id: snap.id,
            email: data.email ?? firebaseUser.email ?? "",
            fullName: data.fullName ?? firebaseUser.email ?? "",
            phone: data.phone,
            role: data.role,
            status: data.status ?? "ACTIVE",
            avatarUrl: data.avatarUrl ?? null,
          });
        } else {
          // Lần đăng nhập đầu tiên của tài khoản này chưa có hồ sơ Firestore — tự tạo với vai trò
          // thấp nhất (STAFF), theo đúng rule bảo mật cho phép tự tạo hồ sơ của chính mình.
          // Muốn nâng quyền ADMIN cho tài khoản đầu tiên phải làm thủ công 1 lần trong Firebase Console.
          void setDoc(doc(db, "users", firebaseUser.uid), {
            email: firebaseUser.email ?? "",
            fullName: firebaseUser.email ?? "",
            role: "STAFF",
            status: "ACTIVE",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: firebaseUser.uid,
            updatedBy: firebaseUser.uid,
          });
          setUser(null);
        }
        setProfileResolved(true);
      },
      () => setProfileResolved(true)
    );
    return () => unsubProfile();
  }, [firebaseUser]);

  return (
    <CurrentUserContext.Provider
      value={{ firebaseUser, user, isLoading: !authResolved || (!!firebaseUser && !profileResolved) }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return context;
}
