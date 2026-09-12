import { BaseEntity } from "./common";

export interface UnitOfMeasure extends BaseEntity {
  code: string;
  name: string;
}

export interface PaymentMethodOption extends BaseEntity {
  code: string;
  name: string;
}
