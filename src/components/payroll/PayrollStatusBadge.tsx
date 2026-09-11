import Badge from "@/components/ui/badge/Badge";
import { PAYROLL_PERIOD_STATUS_LABEL, PayrollPeriodStatus } from "@/types/payroll";

const COLOR_BY_STATUS: Record<PayrollPeriodStatus, "light" | "warning" | "success" | "info" | "error"> = {
  DRAFT: "light",
  CALCULATED: "warning",
  LOCKED: "info",
  PAID: "success",
};

export function PayrollStatusBadge({ status }: { status: PayrollPeriodStatus }) {
  return (
    <Badge color={COLOR_BY_STATUS[status]} size="sm">
      {PAYROLL_PERIOD_STATUS_LABEL[status]}
    </Badge>
  );
}
