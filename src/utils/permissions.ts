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

type PermissionMap = Record<string, Action[] | "FULL">;

const MASTER_DATA_RESOURCES = [
  "customer",
  "vendor",
  "vehicle",
  "driver",
  "location",
  "product",
  "price",
];

const masterDataFull = (): PermissionMap =>
  Object.fromEntries(
    MASTER_DATA_RESOURCES.map((r) => [r, ["VIEW", "CREATE", "UPDATE", "EXPORT", "IMPORT", "PRINT"] as Action[]])
  );

const masterDataViewOnly = (): PermissionMap =>
  Object.fromEntries(MASTER_DATA_RESOURCES.map((r) => [r, ["VIEW"] as Action[]]));

const ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
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

export function hasPermission(role: Role | undefined, resource: string, action: Action): boolean {
  if (!role) return false;
  const map = ROLE_PERMISSIONS[role];
  if (!map) return false;
  if (map["*"] === "FULL") return true;
  const actions = map[resource];
  if (!actions) return false;
  if (actions === "FULL") return true;
  return actions.includes(action);
}
