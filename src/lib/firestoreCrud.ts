import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { BaseEntity } from "@/types/common";

/**
 * Firestore từ chối giá trị undefined. Field không có giá trị (vd: ngày hết hiệu lực để trống)
 * phải được loại khỏi payload trước khi ghi, nếu không toàn bộ lệnh ghi sẽ lỗi.
 */
function omitUndefined<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

export interface CrudServiceOptions {
  /**
   * Bật cache trong bộ nhớ phía client cho collection này (mục 2.4 spec nghiệp vụ).
   * Chỉ bật cho danh mục / bảng giá (ít thay đổi) — KHÔNG bật cho dữ liệu giao dịch
   * (chuyến, thu-chi, công nợ, lương...) vì nhiều người dùng có thể cùng thao tác đồng thời.
   * Mặc định false để service mới không vô tình cache sai dữ liệu giao dịch.
   */
  cache?: boolean;
}

/**
 * Factory tạo service CRUD Firestore dùng chung cho các danh mục (master data).
 * Không xóa cứng — "xóa" thực chất là chuyển status sang INACTIVE (mục 40 spec nghiệp vụ).
 */
export function createCrudService<T extends BaseEntity<unknown>>(
  collectionName: string,
  options?: CrudServiceOptions
) {
  const col = collection(db, collectionName);
  const useCache = options?.cache ?? false;
  // Cache theo phiên làm việc phía client — null nghĩa là "chưa tải" hoặc "vừa bị vô hiệu hóa".
  let cache: T[] | null = null;

  const invalidateCache = () => {
    cache = null;
  };

  return {
    collectionName,

    async getAll(): Promise<T[]> {
      if (useCache && cache) return cache;
      const snap = await getDocs(query(col, orderBy("createdAt", "desc")));
      const result = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      if (useCache) cache = result;
      return result;
    },

    async getById(id: string): Promise<T | null> {
      if (useCache && cache) {
        const cached = cache.find((item) => item.id === id);
        if (cached) return cached;
      }
      const snap = await getDoc(doc(db, collectionName, id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
    },

    async create(
      data: Omit<T, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">,
      userId: string
    ): Promise<string> {
      const ref = await addDoc(col, {
        ...omitUndefined(data),
        status: data.status ?? "ACTIVE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
        updatedBy: userId,
      });
      invalidateCache();
      return ref.id;
    },

    async update(
      id: string,
      data: Partial<Omit<T, "id" | "createdAt" | "createdBy">>,
      userId: string
    ): Promise<void> {
      await updateDoc(doc(db, collectionName, id), {
        ...omitUndefined(data),
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
      invalidateCache();
    },

    async setStatus(id: string, status: T["status"], userId: string): Promise<void> {
      await updateDoc(doc(db, collectionName, id), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
      invalidateCache();
    },

    /**
     * Kiểm tra trùng giá trị 1 field (vd: mã khách hàng, biển số xe) trước khi lưu.
     * Luôn hỏi thẳng Firestore (không qua cache) vì đây là điều kiện chặn lưu, cần chính xác tuyệt đối.
     */
    async existsByField(field: string, value: string, excludeId?: string): Promise<boolean> {
      const snap = await getDocs(query(col, where(field, "==", value)));
      return snap.docs.some((d) => d.id !== excludeId);
    },
  };
}

export type CrudService<T extends BaseEntity> = ReturnType<typeof createCrudService<T>>;
