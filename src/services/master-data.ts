import { createCrudService } from "@/lib/firestoreCrud";
import { CostType } from "@/types/cost-type";
import { Customer, Driver, Location, Product, Vehicle, Vendor } from "@/types/master-data";
import { TransportPrice } from "@/types/pricing";
import { PaymentMethodOption, UnitOfMeasure } from "@/types/payment-settings";

// Danh mục / bảng giá ít thay đổi — bật cache theo mục 2.4 spec nghiệp vụ (tự xóa cache khi
// create/update/setStatus, tự nạp lại ở lần getAll() kế tiếp).
export const customerService = createCrudService<Customer>("customers", { cache: true });
export const vendorService = createCrudService<Vendor>("vendors", { cache: true });
export const locationService = createCrudService<Location>("locations", { cache: true });
export const productService = createCrudService<Product>("products", { cache: true });
export const driverService = createCrudService<Driver>("drivers", { cache: true });
export const vehicleService = createCrudService<Vehicle>("vehicles", { cache: true });
export const priceListService = createCrudService<TransportPrice>("price_lists", { cache: true });
export const costTypeService = createCrudService<CostType>("cost_types", { cache: true });
export const unitOfMeasureService = createCrudService<UnitOfMeasure>("units_of_measure", { cache: true });
export const paymentMethodService = createCrudService<PaymentMethodOption>("payment_methods", { cache: true });
