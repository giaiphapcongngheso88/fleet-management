"use client";

import { PayrollPeriodDetail } from "@/components/payroll/PayrollPeriodDetail";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 py-2 overflow-y-auto print:overflow-visible print:h-auto print:border-0 dark:border-gray-800 dark:bg-white/[0.03]">
      <PayrollPeriodDetail periodId={params.id} />
    </div>
  );
}
