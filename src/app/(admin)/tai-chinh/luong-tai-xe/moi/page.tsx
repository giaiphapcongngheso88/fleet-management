"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select/select";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { payrollPeriodService } from "@/services/payroll";
import { getErrorMessage } from "@/utils/errorHandler";
import { endOfMonth, format } from "date-fns";
import { ArrowLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const now = new Date();
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Tháng ${i + 1}`,
}));
// Cho phép lùi 3 năm (bổ sung/điều chỉnh kỳ cũ) và tới trước 1 năm (lập kế hoạch).
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const year = now.getFullYear() - 3 + i;
  return { value: String(year), label: `Năm ${year}` };
});

export default function NewPayrollPeriodPage() {
  const router = useRouter();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const onCreate = async () => {
    const periodCode = `${year}-${month.padStart(2, "0")}`;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const exists = await payrollPeriodService.existsByField("periodCode", periodCode);
      if (exists) {
        await alert({ title: "Cảnh báo", content: `Kỳ lương tháng ${month}/${year} đã tồn tại.` });
        return;
      }
      const monthDate = new Date(Number(year), Number(month) - 1, 1);
      const fromDate = `${periodCode}-01`;
      const toDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
      const id = await payrollPeriodService.create(
        {
          status: "DRAFT",
          periodCode,
          fromDate,
          toDate,
          items: [],
        },
        user?.id ?? ""
      );
      router.push(`/tai-chinh/luong-tai-xe/${id}`);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Tạo kỳ lương thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 py-2 overflow-y-auto dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="shrink-0 text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Tạo kỳ lương mới</h3>
      <div className="max-w-xs flex flex-col gap-2">
        <Label>
          Tháng lương <span className="text-error-500">*</span>
        </Label>
        <div className="flex gap-2">
          <Select options={MONTH_OPTIONS} value={month} onChange={setMonth} className="flex-1" />
          <Select options={YEAR_OPTIONS} value={year} onChange={setYear} className="flex-1" />
        </div>
        <p className="text-xs text-gray-400">
          Hệ thống sẽ lấy toàn bộ chuyến đã hoàn thành/đối soát và phiếu ứng lương trong tháng này để tính lương.
        </p>
      </div>
      <div className="flex gap-2 mt-6">
        <Button type="button" variant="outline" onClick={() => router.push("/tai-chinh/luong-tai-xe")}>
          <ArrowLeft className="h-4 w-4" />
          Hủy bỏ
        </Button>
        <Button type="button" variant="default" onClick={onCreate}>
          <Check className="h-4 w-4" />
          Tạo kỳ lương
        </Button>
      </div>
    </div>
  );
}
