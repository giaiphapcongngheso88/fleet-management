import { createCrudService } from "@/lib/firestoreCrud";
import { Customer, Driver, Location, Product, Vehicle, Vendor } from "@/types/master-data";
import { TransportPrice } from "@/types/pricing";

export const customerService = createCrudService<Customer>("customers");
export const vendorService = createCrudService<Vendor>("vendors");
export const locationService = createCrudService<Location>("locations");
export const productService = createCrudService<Product>("products");
export const driverService = createCrudService<Driver>("drivers");
export const vehicleService = createCrudService<Vehicle>("vehicles");
export const priceListService = createCrudService<TransportPrice>("price_lists");
