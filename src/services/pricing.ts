import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TransportPrice } from "@/types/pricing";

const col = collection(db, "price_lists");

/**
 * Tra bảng giá theo mục 17.3: customer + pickup + dropoff + product + ngày.
 * Nếu có nhiều mức giá cùng hiệu lực tại ngày tra cứu (trùng cấu hình), ưu tiên bản ghi có
 * effectiveFrom gần ngày tra cứu nhất (mới thiết lập nhất) và trả về cờ hasConflict để nơi gọi
 * cảnh báo người dùng (mục 17.3: "Báo lỗi/cảnh báo khi có xung đột giá").
 */
export async function findEffectivePrice(params: {
  customerId: string;
  pickupLocationId: string;
  dropoffLocationId: string;
  productId: string;
  date: string; // yyyy-MM-dd
}): Promise<{ price: TransportPrice | null; hasConflict: boolean; candidates: TransportPrice[] }> {
  const snap = await getDocs(
    query(
      col,
      where("customerId", "==", params.customerId),
      where("pickupLocationId", "==", params.pickupLocationId),
      where("dropoffLocationId", "==", params.dropoffLocationId),
      where("productId", "==", params.productId),
      where("status", "==", "ACTIVE")
    )
  );

  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TransportPrice);
  const effective = all.filter(
    (p) => p.effectiveFrom <= params.date && (!p.effectiveTo || p.effectiveTo >= params.date)
  );

  if (effective.length === 0) {
    return { price: null, hasConflict: false, candidates: [] };
  }

  const sorted = [...effective].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  return {
    price: sorted[0],
    hasConflict: effective.length > 1,
    candidates: sorted,
  };
}

/**
 * Kiểm tra chồng lấn hiệu lực giữa các bảng giá có cùng tuyến/khách/hàng hóa,
 * dùng khi thêm/sửa bảng giá để chặn tạo xung đột ngay từ đầu (mục 17.3).
 */
export async function findOverlappingPrices(params: {
  customerId: string;
  pickupLocationId: string;
  dropoffLocationId: string;
  productId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  excludeId?: string;
}): Promise<TransportPrice[]> {
  const snap = await getDocs(
    query(
      col,
      where("customerId", "==", params.customerId),
      where("pickupLocationId", "==", params.pickupLocationId),
      where("dropoffLocationId", "==", params.dropoffLocationId),
      where("productId", "==", params.productId),
      where("status", "==", "ACTIVE")
    )
  );

  const newFrom = params.effectiveFrom;
  const newTo = params.effectiveTo || "9999-12-31";

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TransportPrice)
    .filter((p) => p.id !== params.excludeId)
    .filter((p) => {
      const existingFrom = p.effectiveFrom;
      const existingTo = p.effectiveTo || "9999-12-31";
      return newFrom <= existingTo && existingFrom <= newTo;
    });
}
