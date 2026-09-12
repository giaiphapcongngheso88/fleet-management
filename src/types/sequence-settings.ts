import { BaseEntity } from "./common";

export type SequenceKind = "trip" | "receipt" | "payment" | "quote";

export interface SequenceSetting extends BaseEntity {
  key: SequenceKind;
  prefix: string;
  nextNumber: number;
}
