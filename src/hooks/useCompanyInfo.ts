import { CompanyInfo, DEFAULT_COMPANY_INFO, getCompanyInfo } from "@/services/companyInfo";
import { useEffect, useState } from "react";

/**
 * Tải thông tin công ty (letterhead/logo/con dấu/chữ ký) dùng cho bản in trên trình duyệt
 * (`PrintHeader`/`PrintSignatureBlock`) — gọi ngay khi trang mount (không phải lúc bấm "In") để dữ
 * liệu chắc chắn sẵn sàng trước khi người dùng bấm in, tránh phải chờ Firestore ngay lúc `window.print()`.
 */
export function useCompanyInfo(): CompanyInfo {
  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);

  useEffect(() => {
    let cancelled = false;
    void getCompanyInfo().then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
