"use client";

import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { getErrorMessage } from "@/utils/errorHandler";
import { useEffect, useState } from "react";

/**
 * Tải danh sách danh mục dùng cho dropdown (khách hàng, điểm, hàng hóa...).
 * Luôn báo lỗi ra màn hình nếu tải thất bại — không để dropdown rỗng im lặng khiến người dùng
 * tưởng là chưa có dữ liệu.
 */
export function useReferenceData<T>(loader: () => Promise<T[]>, label: string): T[] {
  const [data, setData] = useState<T[]>([]);
  const { alert } = useFeedbackDialog();

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        await alert({
          title: "Lỗi",
          content: `Không tải được danh sách ${label}: ${getErrorMessage(err)}`,
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return data;
}
