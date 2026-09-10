import Badge from "@/components/ui/badge/Badge";
import { EntityStatus, STATUS_LABEL } from "@/types/common";

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <Badge color={status === "ACTIVE" ? "success" : "light"} size="sm">
      {STATUS_LABEL[status]}
    </Badge>
  );
}
