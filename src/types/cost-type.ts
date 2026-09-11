import { BaseEntity } from "./common";

/**
 * Loại chi phí (mục 19 spec) — cấu hình được, không hard-code trong business logic.
 * Dùng chung cho cả chi phí chuyến (TripCost) lẫn Thu-Chi (FinanceTransaction), phân biệt qua
 * isTripCost / isCashTransaction để không phải tạo 2 danh mục trùng lặp.
 */
export interface CostType extends BaseEntity {
  code: string;
  name: string;
  /** Đánh dấu loại chi phí thuộc nhóm nhiên liệu, dùng để tính fuelActualAmount (mục 5.5). */
  isFuel: boolean;
  /** Dùng làm loại chi phí chuyến (dropdown trong TripForm). */
  isTripCost: boolean;
  /** Dùng làm loại thu/chi (dropdown trong màn Thu - Chi). */
  isCashTransaction: boolean;
}
