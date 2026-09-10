import { Timestamp } from "firebase/firestore";

export type EntityStatus = "ACTIVE" | "INACTIVE";

export interface BaseEntity {
  id: string;
  status: EntityStatus;
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export const STATUS_LABEL: Record<EntityStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
};
