import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeKey, ParseResult } from "@/lib/excel/masterDataParser";
import {
  costTypeService,
  customerService,
  driverService,
  locationService,
  priceListService,
  productService,
  vehicleService,
  vendorService,
} from "./master-data";

export type ImportCounters = { created: number; skipped: number };

export type ImportResult = {
  customers: ImportCounters;
  vendors: ImportCounters;
  drivers: ImportCounters;
  vehicles: ImportCounters;
  locations: ImportCounters;
  products: ImportCounters;
  prices: ImportCounters;
  costTypes: ImportCounters;
  errors: string[];
};

/**
 * Firestore giới hạn số lệnh get()/exists() trong security rules cho mỗi request ghi nhiều
 * document (20). Rules của hệ thống phải get() hồ sơ người dùng để kiểm tra vai trò trên từng
 * document, nên lô phải nhỏ — 10 dòng/lô là an toàn (Firestore cho tối đa 500 dòng/lô về mặt ghi).
 */
const BATCH_LIMIT = 10;

type PendingWrite = { collectionName: string; id: string; data: Record<string, unknown> };

/**
 * Ghi dữ liệu theo lô (batch) để import nhanh và không bị treo giữa đường.
 * ID được sinh trước ở client nên có thể liên kết khóa ngoại (xe → tài xế, bảng giá → điểm/hàng hóa)
 * ngay trong cùng một lần import.
 */
class BatchWriter {
  private pending: PendingWrite[] = [];

  constructor(private readonly userId: string, private readonly onProgress?: (message: string) => void) {}

  prepare(collectionName: string, data: Record<string, unknown>): string {
    const ref = doc(collection(db, collectionName));
    this.pending.push({
      collectionName,
      id: ref.id,
      data: {
        ...data,
        status: "ACTIVE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: this.userId,
        updatedBy: this.userId,
      },
    });
    return ref.id;
  }

  async flush(): Promise<void> {
    const total = this.pending.length;
    let written = 0;
    while (this.pending.length > 0) {
      const chunk = this.pending.splice(0, BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, item.collectionName, item.id), item.data);
      }
      await batch.commit();
      written += chunk.length;
      this.onProgress?.(`Đang ghi dữ liệu: ${written}/${total} dòng...`);
    }
  }
}

export async function importMasterData(
  parsed: ParseResult,
  options: { userId: string; effectiveFrom: string; onProgress?: (message: string) => void }
): Promise<ImportResult> {
  const { userId, effectiveFrom, onProgress } = options;
  const writer = new BatchWriter(userId, onProgress);
  const errors: string[] = [];

  onProgress?.("Đang đọc dữ liệu danh mục hiện có...");
  const [
    existingCustomers,
    existingVendors,
    existingDrivers,
    existingVehicles,
    existingLocations,
    existingProducts,
    existingPrices,
    existingCostTypes,
  ] = await Promise.all([
    customerService.getAll(),
    vendorService.getAll(),
    driverService.getAll(),
    vehicleService.getAll(),
    locationService.getAll(),
    productService.getAll(),
    priceListService.getAll(),
    costTypeService.getAll(),
  ]);

  const customerIdByCode = new Map(existingCustomers.map((c) => [normalizeKey(c.code), c.id]));
  const vendorIdByName = new Map(existingVendors.map((v) => [normalizeKey(v.name), v.id]));
  const driverIdByName = new Map(existingDrivers.map((d) => [normalizeKey(d.name), d.id]));
  const vehicleIdByPlate = new Map(existingVehicles.map((v) => [normalizeKey(v.licensePlate), v.id]));
  const locationIdByName = new Map(existingLocations.map((l) => [normalizeKey(l.name), l.id]));
  const productIdByName = new Map(existingProducts.map((p) => [normalizeKey(p.name), p.id]));
  const priceKeys = new Set(
    existingPrices.map((p) => [p.customerId, p.pickupLocationId, p.dropoffLocationId, p.productId].join("|"))
  );
  const costTypeNameSeen = new Set(existingCostTypes.map((c) => normalizeKey(c.name)));

  const result: ImportResult = {
    customers: { created: 0, skipped: 0 },
    vendors: { created: 0, skipped: 0 },
    drivers: { created: 0, skipped: 0 },
    vehicles: { created: 0, skipped: 0 },
    locations: { created: 0, skipped: 0 },
    products: { created: 0, skipped: 0 },
    prices: { created: 0, skipped: 0 },
    costTypes: { created: 0, skipped: 0 },
    errors,
  };

  onProgress?.("Đang chuẩn bị dữ liệu khách hàng, đơn vị vận tải, tài xế...");

  for (const customer of parsed.customers) {
    const key = normalizeKey(customer.code);
    if (customerIdByCode.has(key)) {
      result.customers.skipped++;
      continue;
    }
    const id = writer.prepare("customers", {
      code: customer.code,
      name: customer.name,
      taxCode: customer.taxCode,
      address: customer.address,
      phone: customer.phone,
      type: customer.type,
      note: "",
    });
    customerIdByCode.set(key, id);
    result.customers.created++;
  }

  for (const vendor of parsed.vendors) {
    const key = normalizeKey(vendor.name);
    if (vendorIdByName.has(key)) {
      result.vendors.skipped++;
      continue;
    }
    const id = writer.prepare("vendors", {
      code: vendor.code,
      name: vendor.name,
      taxCode: "",
      address: "",
      phone: "",
      note: "",
    });
    vendorIdByName.set(key, id);
    result.vendors.created++;
  }

  for (const driver of parsed.drivers) {
    const key = normalizeKey(driver.name);
    if (driverIdByName.has(key)) {
      result.drivers.skipped++;
      continue;
    }
    const id = writer.prepare("drivers", {
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      citizenId: driver.citizenId,
      baseSalary: driver.baseSalary,
      note: "",
    });
    driverIdByName.set(key, id);
    result.drivers.created++;
  }

  for (const location of parsed.locations) {
    const key = normalizeKey(location.name);
    if (locationIdByName.has(key)) {
      result.locations.skipped++;
      continue;
    }
    const id = writer.prepare("locations", {
      code: location.code,
      name: location.name,
      type: location.type,
      address: "",
      note: "",
    });
    locationIdByName.set(key, id);
    result.locations.created++;
  }

  for (const product of parsed.products) {
    const key = normalizeKey(product.name);
    if (productIdByName.has(key)) {
      result.products.skipped++;
      continue;
    }
    const id = writer.prepare("products", {
      code: product.code,
      name: product.name,
      unit: product.unit,
      note: "",
    });
    productIdByName.set(key, id);
    result.products.created++;
  }

  for (const vehicle of parsed.vehicles) {
    const key = normalizeKey(vehicle.licensePlate);
    if (vehicleIdByPlate.has(key)) {
      result.vehicles.skipped++;
      continue;
    }
    const id = writer.prepare("vehicles", {
      licensePlate: vehicle.licensePlate,
      trailerNumber: vehicle.trailerNumber,
      phone: vehicle.phone,
      driverId: vehicle.driverName ? driverIdByName.get(normalizeKey(vehicle.driverName)) ?? "" : "",
      vendorId: vehicle.vendorName ? vendorIdByName.get(normalizeKey(vehicle.vendorName)) ?? "" : "",
      note: "",
    });
    vehicleIdByPlate.set(key, id);
    result.vehicles.created++;
  }

  for (const price of parsed.prices) {
    const customerId = customerIdByCode.get(normalizeKey(price.customerCode));
    const pickupLocationId = locationIdByName.get(normalizeKey(price.pickupName));
    const dropoffLocationId = locationIdByName.get(normalizeKey(price.dropoffName));
    const productId = productIdByName.get(normalizeKey(price.productName));

    if (!customerId || !pickupLocationId || !dropoffLocationId || !productId) {
      errors.push(
        `Bảng giá "${price.customerCode} / ${price.pickupName} → ${price.dropoffName} / ${price.productName}": không tìm thấy ${[
          !customerId && "khách hàng",
          !pickupLocationId && "điểm nâng",
          !dropoffLocationId && "điểm hạ",
          !productId && "hàng hóa",
        ]
          .filter(Boolean)
          .join(", ")} trong danh mục.`
      );
      continue;
    }

    const comboKey = [customerId, pickupLocationId, dropoffLocationId, productId].join("|");
    if (priceKeys.has(comboKey)) {
      result.prices.skipped++;
      continue;
    }
    priceKeys.add(comboKey);

    writer.prepare("price_lists", {
      customerId,
      pickupLocationId,
      dropoffLocationId,
      productId,
      unit: price.unit,
      salesPrice: price.salesPrice,
      dropFee: price.dropFee,
      vendorCost: price.vendorCost,
      driverTripSalary: price.driverTripSalary,
      ticketFee: price.ticketFee,
      otherFee: 0,
      fuelNormAmount: price.fuelNormAmount,
      effectiveFrom,
      note: "Import từ Excel ĐẠI PHÁT 1.3",
    });
    result.prices.created++;
  }

  for (const costType of parsed.costTypes) {
    const key = normalizeKey(costType.name);
    if (costTypeNameSeen.has(key)) {
      result.costTypes.skipped++;
      continue;
    }
    costTypeNameSeen.add(key);
    writer.prepare("cost_types", {
      code: costType.code,
      name: costType.name,
      isFuel: costType.isFuel,
      isTripCost: costType.isTripCost,
      isCashTransaction: costType.isCashTransaction,
      note: "Import từ Excel ĐẠI PHÁT 1.3",
    });
    result.costTypes.created++;
  }

  onProgress?.("Đang ghi dữ liệu lên Firestore...");
  await writer.flush();

  return result;
}
