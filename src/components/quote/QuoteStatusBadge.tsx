import Badge from "@/components/ui/badge/Badge";
import { QUOTE_STATUS_LABEL, QuoteStatus } from "@/types/quote";

const COLOR_BY_STATUS: Record<QuoteStatus, "light" | "warning" | "success" | "info" | "error"> = {
  DRAFT: "light",
  SENT: "warning",
  APPROVED: "success",
  EXPIRED: "info",
  CANCELLED: "error",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge color={COLOR_BY_STATUS[status]} size="sm">
      {QUOTE_STATUS_LABEL[status]}
    </Badge>
  );
}
