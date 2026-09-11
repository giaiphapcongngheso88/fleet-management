import Badge from "@/components/ui/badge/Badge";
import { TRIP_STATUS_LABEL, TripStatus } from "@/types/trip";

const COLOR_BY_STATUS: Record<TripStatus, "light" | "warning" | "success" | "info" | "error"> = {
  DRAFT: "light",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  RECONCILED: "info",
  CANCELLED: "error",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <Badge color={COLOR_BY_STATUS[status]} size="sm">
      {TRIP_STATUS_LABEL[status]}
    </Badge>
  );
}
