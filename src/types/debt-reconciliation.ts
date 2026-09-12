import { BaseEntity } from "./common";

export type DebtReconciliationObjectType = "CUSTOMER" | "VENDOR";

export interface DebtReconciliation extends BaseEntity {
  objectType: DebtReconciliationObjectType;
  objectId: string;
  reconciliationDate: string;
  asOfDate: string;
  calculatedAmount: number;
  confirmedAmount: number;
  note?: string;
}
