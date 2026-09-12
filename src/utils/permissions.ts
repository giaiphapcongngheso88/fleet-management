// Phân quyền theo module + action (mục 38 đặc tả nghiệp vụ).
// Chưa có UI quản lý nhóm quyền động (P1) — dùng bảng vai trò cố định trước, dễ thay bằng
// cấu hình Firestore sau mà không phải sửa lại chỗ gọi can().

export type Role = "ADMIN" | "QUAN_LY" | "DIEU_HANH" | "KE_TOAN" | "STAFF";

export type Action =
  | "VIEW"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "IMPORT"
  | "EXPORT"
  | "PRINT"
  | "APPROVE"
  | "LOCK"
  | "UNLOCK";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị hệ thống",
  QUAN_LY: "Quản lý",
  DIEU_HANH: "Điều hành",
  KE_TOAN: "Kế toán",
  STAFF: "Nhân viên",
};

export const ALL_ROLES: Role[] = ["ADMIN", "QUAN_LY", "DIEU_HANH", "KE_TOAN", "STAFF"];

/** Vai trò có thể tự cấu hình quyền qua UI (mục 38) — ADMIN luôn FULL cứng, không cho sửa để tránh tự khóa mất quyền admin. */
export const EDITABLE_ROLES: Role[] = ALL_ROLES.filter((r) => r !== "ADMIN");

export const ALL_ACTIONS: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT", "PRINT", "APPROVE", "LOCK", "UNLOCK"];

/** Tên hiển thị tiếng Việt cho từng resource — dùng ở màn hình cấu hình phân quyền. */
export const RESOURCE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  customer: "Khách hàng",
  vendor: "Đơn vị vận tải",
  vehicle: "Xe",
  driver: "Tài xế",
  location: "Điểm nâng/hạ",
  product: "Hàng hóa",
  "cost-type": "Loại chi phí",
  price: "Bảng giá vận chuyển",
  trip: "Chuyến xe",
  finance: "Thu - Chi",
  receivable: "Công nợ khách hàng",
  payable: "Công nợ đơn vị vận tải",
  payroll: "Lương tài xế",
  quote: "Báo giá",
  report: "Báo cáo",
  user: "Người dùng",
  import: "Import Excel",
  setting: "Cấu hình hệ thống",
  "audit-log": "Nhật ký thao tác",
};

/** Thứ tự hiển thị các resource trong bảng cấu hình quyền, nhóm theo nghiệp vụ. */
export const PERMISSION_RESOURCES = [
  "dashboard",
  "customer",
  "vendor",
  "vehicle",
  "driver",
  "location",
  "product",
  "cost-type",
  "price",
  "trip",
  "finance",
  "receivable",
  "payable",
  "payroll",
  "quote",
  "report",
  "user",
  "import",
  "setting",
  "audit-log",
];

export type PermissionMap = Record<string, Action[] | "FULL">;

const MASTER_DATA_RESOURCES = [
  "customer",
  "vendor",
  "vehicle",
  "driver",
  "location",
  "product",
  "price",
  "cost-type",
];

const masterDataFull = (): PermissionMap =>
  Object.fromEntries(
    MASTER_DATA_RESOURCES.map((r) => [r, ["VIEW", "CREATE", "UPDATE", "EXPORT", "IMPORT", "PRINT"] as Action[]])
  );

const masterDataViewOnly = (): PermissionMap =>
  Object.fromEntries(MASTER_DATA_RESOURCES.map((r) => [r, ["VIEW"] as Action[]]));

/**
 * Bảng phân quyền mặc định (mục 38) — dùng làm giá trị khởi tạo/khôi phục cho màn hình cấu hình
 * quyền động (Firestore collection `role_permissions`, xem `src/services/rolePermissions.ts`), và
 * làm phương án dự phòng khi chưa tải xong/chưa có dữ liệu Firestore cho vai trò đó.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
  ADMIN: {
    "*": "FULL",
  },
  QUAN_LY: {
    ...masterDataFull(),
    trip: ["VIEW", "CREATE", "UPDATE", "APPROVE", "LOCK", "UNLOCK", "EXPORT", "IMPORT", "PRINT"],
    finance: ["VIEW", "CREATE", "UPDATE", "APPROVE", "LOCK", "UNLOCK", "EXPORT", "PRINT"],
    receivable: ["VIEW", "UPDATE", "APPROVE"],
    payable: ["VIEW", "UPDATE", "APPROVE"],
    payroll: ["VIEW", "APPROVE", "LOCK", "UNLOCK"],
    quote: ["VIEW", "CREATE", "UPDATE", "APPROVE", "PRINT"],
    report: ["VIEW", "EXPORT", "PRINT"],
    user: ["VIEW"],
    setting: ["VIEW", "UPDATE"],
    "audit-log": ["VIEW"],
    import: ["VIEW", "IMPORT"],
  },
  DIEU_HANH: {
    ...masterDataFull(),
    trip: ["VIEW", "CREATE", "UPDATE", "EXPORT", "IMPORT", "PRINT"],
    quote: ["VIEW", "CREATE", "UPDATE", "PRINT"],
    report: ["VIEW"],
    import: ["VIEW", "IMPORT"],
  },
  KE_TOAN: {
    ...masterDataViewOnly(),
    trip: ["VIEW"],
    finance: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT"],
    receivable: ["VIEW", "UPDATE"],
    payable: ["VIEW", "UPDATE"],
    payroll: ["VIEW", "CREATE", "UPDATE"],
    quote: ["VIEW"],
    report: ["VIEW", "EXPORT", "PRINT"],
  },
  STAFF: {
    ...masterDataViewOnly(),
    trip: ["VIEW"],
    quote: ["VIEW"],
  },
};

/**
 * `overrides` là bảng quyền đã tải từ Firestore (do Admin tự cấu hình qua UI) — chỉ áp dụng cho vai
 * trò có trong `overrides`; ADMIN luôn dùng đúng bảng mặc định (FULL cứng), không bao giờ đọc từ
 * `overrides` dù Firestore có dữ liệu gì đi nữa, để không thể tự khóa mất quyền admin qua màn hình
 * cấu hình quyền.
 */
export function hasPermission(
  role: Role | undefined,
  resource: string,
  action: Action,
  overrides?: Partial<Record<Role, PermissionMap>>
): boolean {
  if (!role) return false;
  const map = (role !== "ADMIN" && overrides?.[role]) || DEFAULT_ROLE_PERMISSIONS[role];
  if (!map) return false;
  if (map["*"] === "FULL") return true;
  const actions = map[resource];
  if (!actions) return false;
  if (actions === "FULL") return true;
  return actions.includes(action);
}
