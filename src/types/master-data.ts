import { BaseEntity } from "./common";

export interface Customer extends BaseEntity {
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  type?: string;
}

export interface Vendor extends BaseEntity {
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  phone?: string;
}

export type LocationType = "PICKUP" | "DROPOFF" | "BOTH";

export interface Location extends BaseEntity {
  code: string;
  name: string;
  address?: string;
  type: LocationType;
}

export interface Product extends BaseEntity {
  code: string;
  name: string;
  unit: string;
}

export interface Driver extends BaseEntity {
  name: string;
  phone?: string;
  licenseNumber?: string;
  citizenId?: string;
  baseSalary?: number;
}

export interface Vehicle extends BaseEntity {
  licensePlate: string;
  trailerNumber?: string;
  driverId?: string;
  vendorId?: string;
  phone?: string;
}

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  PICKUP: "Điểm nâng",
  DROPOFF: "Điểm hạ",
  BOTH: "Nâng & hạ",
};
