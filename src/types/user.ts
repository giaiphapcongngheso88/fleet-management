import { BaseEntity } from "./common";
import { Role } from "@/utils/permissions";

export interface AppUser extends BaseEntity {
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
}
