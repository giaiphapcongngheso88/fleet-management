import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeKey, ParseResult } from "@/lib/excel/masterDataParser";
import { financeTransactionService } from "./finance";
import { tripService } from "./trip";
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
  financeTransactions: ImportCounters;
  trips: ImportCounters;
  errors: string[];
};

/**
 * Firestore giới hạn số lệnh get()/exists() trong security rules cho mỗi request ghi nhiều
 * document (20). Rules của hệ thống phải get() hồ sơ người dùng để kiểm tra vai trò trên từng
 * document, nên lô phải nhỏ — 10 dòng/lô là an toàn (Firestore cho tối đa 500 dòng/lô về mặt ghi).
 */
const BATCH_LIMIT = 10;

type PendingWrite = { collectionName: string; id: string; data: Record<string, unknown> };

function financeImportKey(transaction: {
  transactionDate?: unknown;
  type?: unknown;
  costTypeName?: unknown;
  amount?: unknown;
  description?: unknown;
  vehiclePlate?: string;
}): string {
  const asText = (value: unknown) => (value == null ? "" : String(value).trim());
  return [
    asText(transaction.transactionDate),
    asText(transaction.type),
    normalizeKey(asText(transaction.costTypeName)),
    asText(transaction.amount),
    normalizeKey(asText(transaction.description)),
    normalizeKey(asText(transaction.vehiclePlate)),
  ].join("|");
}

function financeSourceKey(key: string): string {
  return `EXCEL:${key}`;
}

/**
 * Ghi dữ liệu theo lô (batch) để import nhanh và không bị treo giữa đường.
 * ID được sinh trước ở client nên có thể liên kết khóa ngoại (xe → tài xế, bảng giá → điểm/hàng hóa)
 * ngay trong cùng một lần import.
 */
class BatchWriter {
  private pending: PendingWrite[] = [];

  constructor(private readonly userId: string, private readonly onProgress?: (message: string) => void) {}

  prepare(collectionName: string, data: Record<string, unknown>, existingId?: string): string {
    const ref = existingId ? doc(db, collectionName, existingId) : doc(collection(db, collectionName));
    this.pending.push({
      collectionName,
      id: ref.id,
      data: {
        ...data,
        status: data.status ?? "ACTIVE",
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
    existingFinanceTransactions,
  ] = await Promise.all([
    customerService.getAll(),
    vendorService.getAll(),
    driverService.getAll(),
    vehicleService.getAll(),
    locationService.getAll(),
    productService.getAll(),
    priceListService.getAll(),
    costTypeService.getAll(),
    financeTransactionService.getAll(),
  ]);

  const customerIdByCode = new Map(existingCustomers.map((c) => [normalizeKey(c.code), c.id]));
  const customerIdByName = new Map(existingCustomers.map((c) => [normalizeKey(c.name), c.id]));
  const vendorIdByName = new Map(existingVendors.map((v) => [normalizeKey(v.name), v.id]));
  const driverIdByName = new Map(existingDrivers.map((d) => [normalizeKey(d.name), d.id]));
  const vehicleIdByPlate = new Map(existingVehicles.map((v) => [normalizeKey(v.licensePlate), v.id]));
  const locationIdByName = new Map(existingLocations.map((l) => [normalizeKey(l.name), l.id]));
  const productIdByName = new Map(existingProducts.map((p) => [normalizeKey(p.name), p.id]));
  const priceKeys = new Set(
    existingPrices.map((p) => [p.customerId, p.pickupLocationId, p.dropoffLocationId, p.productId].join("|"))
  );
  const costTypeIdByName = new Map(existingCostTypes.map((c) => [normalizeKey(c.name), c.id]));
  const costTypeNameSeen = new Set(existingCostTypes.map((c) => normalizeKey(c.name)));
  const financeImportKeys = new Set(
    existingFinanceTransactions.map((transaction) => {
      const sourceKey = typeof transaction.sourceKey === "string" ? transaction.sourceKey : "";
      if (sourceKey.startsWith("EXCEL:")) return sourceKey.slice("EXCEL:".length);
      const costTypeName = existingCostTypes.find((costType) => costType.id === transaction.costTypeId)?.name ?? "";
      return financeImportKey({
        transactionDate: transaction.transactionDate,
        type: transaction.type,
        costTypeName,
        amount: transaction.amount,
        description:
          typeof transaction.description === "string" && transaction.description.startsWith(`${costTypeName}: `)
            ? transaction.description.slice(costTypeName.length + 2)
            : transaction.description ?? "",
        vehiclePlate: existingVehicles.find((vehicle) => vehicle.id === transaction.objectId)?.licensePlate,
      });
    })
  );

  const result: ImportResult = {
    customers: { created: 0, skipped: 0 },
    vendors: { created: 0, skipped: 0 },
    drivers: { created: 0, skipped: 0 },
    vehicles: { created: 0, skipped: 0 },
    locations: { created: 0, skipped: 0 },
    products: { created: 0, skipped: 0 },
    prices: { created: 0, skipped: 0 },
    costTypes: { created: 0, skipped: 0 },
    financeTransactions: { created: 0, skipped: 0 },
    trips: { created: 0, skipped: 0 },
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
    customerIdByName.set(normalizeKey(customer.name), id);
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

  const ensureCustomer = (name: string): string => {
    const key = normalizeKey(name);
    if (!key) return "";
    const existing = customerIdByName.get(key) ?? customerIdByCode.get(key);
    if (existing) return existing;
    const id = writer.prepare("customers", {
      code: `IMPORT-${String(customerIdByName.size + 1).padStart(4, "0")}`,
      name,
      taxCode: "",
      address: "",
      phone: "",
      type: "Khách hàng",
      note: "Tự tạo từ Nhật trình khi import Excel",
    });
    customerIdByName.set(key, id);
    result.customers.created++;
    return id;
  };

  const ensureLocation = (name: string): string => {
    const key = normalizeKey(name);
    if (!key) return "";
    const existing = locationIdByName.get(key);
    if (existing) return existing;
    const id = writer.prepare("locations", {
      code: `IMPORT-${String(locationIdByName.size + 1).padStart(4, "0")}`,
      name,
      type: "BOTH",
      address: "",
      note: "Tự tạo từ Nhật trình khi import Excel",
    });
    locationIdByName.set(key, id);
    result.locations.created++;
    return id;
  };

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
    const id = writer.prepare("cost_types", {
      code: costType.code,
      name: costType.name,
      isFuel: costType.isFuel,
      isTripCost: costType.isTripCost,
      isCashTransaction: costType.isCashTransaction,
      note: "Import từ Excel ĐẠI PHÁT 1.3",
    });
    costTypeIdByName.set(key, id);
    result.costTypes.created++;
  }

  for (const transaction of parsed.financeTransactions) {
    const importKey = financeImportKey(transaction);
    if (financeImportKeys.has(importKey)) {
      result.financeTransactions.skipped++;
      continue;
    }
    financeImportKeys.add(importKey);
    const costTypeId = costTypeIdByName.get(normalizeKey(transaction.costTypeName));
    writer.prepare("finance_transactions", {
      transactionNo: `IMP-${transaction.transactionDate.replace(/[^0-9]/g, "")}-${result.financeTransactions.created + 1}`,
      sourceKey: financeSourceKey(importKey),
      transactionDate: transaction.transactionDate,
      type: transaction.type,
      costTypeId: costTypeId ?? "",
      objectType: "OTHER",
      objectId: transaction.vehiclePlate ? vehicleIdByPlate.get(normalizeKey(transaction.vehiclePlate)) ?? "" : "",
      amount: transaction.amount,
      paymentMethod: "OTHER",
      description: transaction.description
        ? `${transaction.costTypeName}: ${transaction.description}`
        : transaction.costTypeName,
    });
    result.financeTransactions.created++;
  }

  const existingTrips = await tripService.getAll();
  const tripsByCode = new Map(existingTrips.map((trip) => [normalizeKey(trip.tripCode), trip]));
  const tripCodes = new Set(tripsByCode.keys());
  for (const trip of parsed.trips) {
    const tripKey = normalizeKey(trip.tripCode);
    if (tripCodes.has(tripKey)) {
      const existingTrip = tripsByCode.get(tripKey);
      if (existingTrip && String(existingTrip.status) === "ACTIVE") {
        writer.prepare(
          "trips",
          {
            status: normalizeKey(trip.status).includes("hoàn thành") ? "COMPLETED" : "DRAFT",
            vendorId:
              existingTrip.vendorId ||
              vendorIdByName.get(normalizeKey(trip.vendorName)) ||
              vendorIdByName.get(
                normalizeKey(
                  parsed.vehicles.find(
                    (vehicle) => normalizeKey(vehicle.licensePlate) === normalizeKey(trip.vehiclePlate)
                  )?.vendorName ?? ""
                )
              ) ||
              "",
          },
          existingTrip.id
        );
      }
      result.trips.skipped++;
      continue;
    }
    const vehicleId = vehicleIdByPlate.get(normalizeKey(trip.vehiclePlate)) ?? "";
    const sourceVehicle = parsed.vehicles.find(
      (vehicle) => normalizeKey(vehicle.licensePlate) === normalizeKey(trip.vehiclePlate)
    );
    const customerId = ensureCustomer(trip.customerName);
    const pickupLocationId = ensureLocation(trip.pickupName);
    const dropoffLocationId = ensureLocation(trip.dropoffName);
    if (!customerId || !pickupLocationId || !dropoffLocationId) {
      result.trips.skipped++;
      errors.push(`Chuyến "${trip.tripCode}" thiếu khách hàng hoặc điểm nâng hạ nên không được import.`);
      continue;
    }
    const tripCosts = trip.costs
      .map((cost) => ({ id: crypto.randomUUID(), costTypeId: costTypeIdByName.get(normalizeKey(cost.costTypeName)) ?? "", amount: cost.amount, description: "", transactionDate: trip.tripDate, isFuel: normalizeKey(cost.costTypeName) === "đổ dầu" }))
      .filter((cost) => cost.costTypeId);
    writer.prepare("trips", {
      tripCode: trip.tripCode,
      tripDate: trip.tripDate,
      customerId,
      vehicleId,
      driverId: driverIdByName.get(normalizeKey(trip.driverName || sourceVehicle?.driverName || "")) ?? "",
      vendorId: vendorIdByName.get(normalizeKey(trip.vendorName || sourceVehicle?.vendorName || "")) ?? "",
      lot: trip.lot,
      pickupLocationId,
      dropoffLocationId,
      items: trip.items
        .map((item) => {
          const itemProductId = productIdByName.get(normalizeKey(item.productName));
          return itemProductId
            ? {
                id: crypto.randomUUID(),
                productId: itemProductId,
                quantity: item.quantity,
                unit: "Chuyến",
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
                dropFee: trip.dropFee,
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      costs: tripCosts,
      driverTripSalary: trip.driverTripSalary,
      vendorCost: trip.vendorCost,
      fuelNormAmount: 0,
      revenue: trip.revenue,
      cost: trip.cost,
      profit: trip.profit,
      fuelActualAmount: tripCosts.filter((cost) => cost.isFuel).reduce((sum, cost) => sum + cost.amount, 0),
      fuelVarianceAmount: 0,
      status: normalizeKey(trip.status).includes("hoàn thành") ? "COMPLETED" : "DRAFT",
      note: trip.note,
    });
    tripCodes.add(tripKey);
    result.trips.created++;
  }

  onProgress?.("Đang ghi dữ liệu lên Firestore...");
  await writer.flush();

  return result;
}
