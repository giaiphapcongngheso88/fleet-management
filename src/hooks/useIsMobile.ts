"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)";

/**
 * Ngưỡng chuyển bảng ↔ thẻ (mục 48.1 spec nghiệp vụ) — khớp breakpoint `md` của Tailwind.
 * Mặc định false lúc mount đầu (server không biết kích thước màn hình thật) để tránh lệch hydrate,
 * cập nhật đúng ngay sau khi client mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
