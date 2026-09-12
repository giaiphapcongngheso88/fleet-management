import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Action, DEFAULT_ROLE_PERMISSIONS, EDITABLE_ROLES, PermissionMap, Role } from "@/utils/permissions";

const COLLECTION = "role_permissions";

/** Bỏ 2 field ghi chú thời điểm/người cập nhật, chỉ giữ lại đúng map quyền theo resource. */
function toPermissionMap(data: Record<string, unknown>): PermissionMap {
  const map = { ...data };
  delete map.updatedAt;
  delete map.updatedBy;
  return map as PermissionMap;
}

/**
 * Tải bảng quyền do Admin tự cấu hình (mục 38) — chỉ có dữ liệu cho các vai trò đã từng được lưu qua
 * UI; vai trò chưa có document nào thì nơi gọi tự dùng `DEFAULT_ROLE_PERMISSIONS` (xem `hasPermission`).
 * Không cache ở tầng service (khác danh mục mục 2.4) — bảng quyền hiếm khi đổi nhưng ảnh hưởng bảo
 * mật ngay lập tức, PermissionContext tự tải 1 lần lúc đăng nhập và giữ trong state của phiên đó.
 */
export async function loadRolePermissionOverrides(): Promise<Partial<Record<Role, PermissionMap>>> {
  const snap = await getDocs(collection(db, COLLECTION));
  const result: Partial<Record<Role, PermissionMap>> = {};
  for (const d of snap.docs) {
    result[d.id as Role] = toPermissionMap(d.data());
  }
  return result;
}

export async function getRolePermission(role: Role): Promise<PermissionMap> {
  const snap = await getDoc(doc(db, COLLECTION, role));
  if (!snap.exists()) return DEFAULT_ROLE_PERMISSIONS[role];
  return toPermissionMap(snap.data());
}

/** Ghi đè quyền của 1 vai trò. Không cho phép ghi vai trò ADMIN (luôn FULL cứng, xem hasPermission). */
export async function saveRolePermission(role: Role, permissionMap: PermissionMap, userId: string): Promise<void> {
  if (!EDITABLE_ROLES.includes(role)) {
    throw new Error("Không thể cấu hình quyền cho vai trò Admin.");
  }
  await setDoc(doc(db, COLLECTION, role), {
    ...permissionMap,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/** Khôi phục 1 vai trò về bảng quyền mặc định — xóa document ghi đè (nơi gọi tự dùng lại DEFAULT_ROLE_PERMISSIONS). */
export async function resetRolePermission(role: Role): Promise<void> {
  if (!EDITABLE_ROLES.includes(role)) return;
  await deleteDoc(doc(db, COLLECTION, role));
}

export type { Action };
