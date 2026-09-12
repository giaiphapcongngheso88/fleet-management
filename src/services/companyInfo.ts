import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DOC_REF = () => doc(db, "settings", "company_info");

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  taxCode: string;
  email?: string;
  /** Số tài khoản ngân hàng — hiện ở dòng cuối letterhead, đúng như file Excel gốc. */
  bankAccountNo?: string;
  /** Tên ngân hàng (có thể gồm cả chi nhánh, vd "ACB - PGD Bình Tân" như file gốc). */
  bankName?: string;
  /** Tên giám đốc — in đỏ đậm dưới con dấu/chữ ký ở khối "XÁC NHẬN CỦA CÔNG TY", như file gốc. */
  directorName?: string;
  /** Data URL (data:image/...;base64,...) — undefined = dùng ảnh mặc định trong public/branding/. */
  logoDataUrl?: string;
  sealDataUrl?: string;
  signatureDataUrl?: string;
}

/** Dùng khi chưa admin nào cấu hình `settings/company_info` — đúng dữ liệu trích từ file Excel gốc. */
export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: "CÔNG TY TNHH DỊCH VỤ THƯƠNG MẠI VẬN TẢI ĐẠI PHÁT",
  address: "276/3/45/11 Đường Mã Lò, Phường Bình Trị Đông A, Quận Bình Tân, TP.HCM",
  phone: "123456789",
  taxCode: "0317938395",
  email: "Ctyvantaidaiphat@gmail.com",
  bankAccountNo: "6697796",
  bankName: "ACB - PGD Bình Tân",
  directorName: "NGUYỄN ÚT VÀNG",
};

/**
 * Thông tin công ty dùng cho letterhead/chữ ký khi xuất Excel "đúng phong cách chứng từ gốc" (mục 35)
 * — Admin cấu hình qua trang Thông tin công ty, không hard-code trong `styledWorkbook.ts` nữa. Không
 * cache: số lần gọi xuất Excel thấp, ưu tiên luôn lấy đúng dữ liệu mới nhất Admin vừa lưu.
 */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  const snap = await getDoc(DOC_REF());
  if (!snap.exists()) return DEFAULT_COMPANY_INFO;
  const data = snap.data();
  return {
    name: data.name || DEFAULT_COMPANY_INFO.name,
    address: data.address || DEFAULT_COMPANY_INFO.address,
    phone: data.phone || DEFAULT_COMPANY_INFO.phone,
    taxCode: data.taxCode || DEFAULT_COMPANY_INFO.taxCode,
    email: data.email || DEFAULT_COMPANY_INFO.email,
    bankAccountNo: data.bankAccountNo || DEFAULT_COMPANY_INFO.bankAccountNo,
    bankName: data.bankName || DEFAULT_COMPANY_INFO.bankName,
    directorName: data.directorName || DEFAULT_COMPANY_INFO.directorName,
    logoDataUrl: data.logoDataUrl || undefined,
    sealDataUrl: data.sealDataUrl || undefined,
    signatureDataUrl: data.signatureDataUrl || undefined,
  };
}

export async function saveCompanyInfo(info: CompanyInfo, userId: string): Promise<void> {
  await setDoc(DOC_REF(), { ...info, updatedAt: new Date().toISOString(), updatedBy: userId });
}
