import ExcelJS from "exceljs";
import { LocationType } from "@/types/master-data";

export type ParsedCustomer = {
  code: string;
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  type: string;
};

export type ParsedVendor = { code: string; name: string };

export type ParsedDriver = {
  name: string;
  phone: string;
  licenseNumber: string;
  citizenId: string;
  baseSalary: number;
};

export type ParsedVehicle = {
  licensePlate: string;
  trailerNumber: string;
  phone: string;
  driverName: string;
  vendorName: string;
};

export type ParsedLocation = { code: string; name: string; type: LocationType };

export type ParsedProduct = { code: string; name: string; unit: string };

export type ParsedPrice = {
  customerCode: string;
  pickupName: string;
  dropoffName: string;
  productName: string;
  unit: string;
  salesPrice: number;
  dropFee: number;
  vendorCost: number;
  driverTripSalary: number;
  ticketFee: number;
  /** Cột "Dầu thực tế" trong sheet DS KH,Nâng,Hạ — định mức dầu tham chiếu theo tuyến (mục 5.5). */
  fuelNormAmount: number;
};

export type ParsedCostType = {
  code: string;
  name: string;
  isFuel: boolean;
  isTripCost: boolean;
  isCashTransaction: boolean;
};

export type ParsedFinanceTransaction = {
  transactionDate: string;
  type: "RECEIPT" | "PAYMENT";
  costTypeName: string;
  amount: number;
  description: string;
  vehiclePlate?: string;
};

export type ParsedTrip = {
  tripCode: string;
  tripDate: string;
  vehiclePlate: string;
  customerName: string;
  vendorName: string;
  driverName: string;
  lot: string;
  pickupName: string;
  dropoffName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  items: { productName: string; quantity: number; unitPrice: number }[];
  dropFee: number;
  driverTripSalary: number;
  vendorCost: number;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  note: string;
  costs: { costTypeName: string; amount: number }[];
};

export type ParseResult = {
  customers: ParsedCustomer[];
  vendors: ParsedVendor[];
  drivers: ParsedDriver[];
  vehicles: ParsedVehicle[];
  locations: ParsedLocation[];
  products: ParsedProduct[];
  prices: ParsedPrice[];
  costTypes: ParsedCostType[];
  financeTransactions: ParsedFinanceTransaction[];
  trips: ParsedTrip[];
  warnings: string[];
};

const SHEET_CUSTOMER = "Khách hàng";
const SHEET_VEHICLE = "DS XE";
const SHEET_PRICE = "DS KH,Nâng,Hạ";
const SHEET_FINANCE = "Thu - Chi";
const SHEET_LEDGER = "Sổ thu chi";
const SHEET_TRIPS = "Nhật trình (2)";
const SHEET_VEHICLE_INDEX = "Bảng tổng hợp";

/**
 * Cột tiêu đề của sheet "Thu - Chi" (mỗi cột = 1 loại chi phí/thu-chi, không phải danh sách dạng
 * dòng) + vài loại chỉ xuất hiện ở cột chi phí của sheet "Nhật Trình" (mục 8). Không lấy từ vị trí
 * cột cố định (dễ vỡ khi file thay đổi) — quét toàn bộ ô tiêu đề, tra cờ isFuel/isTripCost/
 * isCashTransaction theo tên đã chuẩn hóa; loại chưa biết mặc định isTripCost = true.
 */
const KNOWN_COST_TYPE_FLAGS: Record<string, { isFuel?: boolean; isTripCost?: boolean; isCashTransaction?: boolean }> = {
  "vá vỏ": { isTripCost: true },
  "đổ dầu": { isFuel: true, isTripCost: true },
  "petrolimex - cửa hàng 72": { isFuel: true, isTripCost: true },
  "vỏ mới": { isTripCost: true },
  "mua vỏ": { isTripCost: true },
  "ứng lương": { isCashTransaction: true },
  "thanh toán": { isCashTransaction: true },
  "thanh toán2": { isCashTransaction: true },
  "thanh toán lương": { isCashTransaction: true },
  "ứng phí": { isTripCost: true, isCashTransaction: true },
  "thuê xe hạ hàng": { isTripCost: true },
  "sữa xe": { isTripCost: true },
  "sửa xe": { isTripCost: true },
  "nộp tiền": { isCashTransaction: true },
  "thai vỏ": { isTripCost: true },
  "thu tiền": { isCashTransaction: true },
  "chi phí khác": { isTripCost: true, isCashTransaction: true },
  "bảo hiểm xe": { isTripCost: true },
  "đăng kiểm xe": { isTripCost: true },
  "đổi phí": { isTripCost: true, isCashTransaction: true },
  "tiền cơm": { isTripCost: true },
  "bốc hàng": { isTripCost: true },
  "vé": { isTripCost: true },
};

/** Tiêu đề không phải tên loại chi phí (cột ngày/đối tượng/ghi chú, hoặc ô trống mặc định của Excel). */
const NON_COST_TYPE_HEADERS = new Set(["date", "ngày", "danh sách", "đối tượng", "nội dung", "diễn giải", "ghi chú", ""]);

type CellValue = ExcelJS.CellValue;

function text(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("").trim();
    }
    if ("result" in value && value.result != null) return String(value.result).trim();
    if ("text" in value && value.text != null) return String(value.text).trim();
    return "";
  }
  return String(value).trim();
}

function num(value: CellValue): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "result" in value && typeof value.result === "number") {
    return value.result;
  }
  const parsed = Number(text(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Chuẩn hóa để so trùng: bỏ dấu cách thừa + không phân biệt hoa/thường. */
export function normalizeKey(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function sequentialCode(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(3, "0")}`;
}

/** "Gạch Ốp Lát / Chuyến." -> { name: "Gạch Ốp Lát", unit: "Chuyến" } */
function splitProductKey(raw: string): { name: string; unit: string } {
  const parts = raw.split("/").map((p) => p.trim().replace(/\.+$/, "").trim());
  return { name: parts[0] ?? "", unit: parts[1] ?? "" };
}

export type ParseOptions = {
  /**
   * File Excel có nhiều dòng bảng giá không ghi hàng hóa. Bật cờ này để vẫn import các dòng đó
   * với hàng hóa "Chưa xác định" (giữ lại đơn giá/cước để bổ sung sau) thay vì bỏ qua.
   */
  includeRowsWithoutProduct?: boolean;
};

export const UNKNOWN_PRODUCT_NAME = "Chưa xác định";

export async function parseMasterDataWorkbook(
  buffer: ArrayBuffer,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const warnings: string[] = [];

  const customerSheet = workbook.getWorksheet(SHEET_CUSTOMER);
  const vehicleSheet = workbook.getWorksheet(SHEET_VEHICLE);
  const priceSheet = workbook.getWorksheet(SHEET_PRICE);
  const financeSheet = workbook.getWorksheet(SHEET_FINANCE);
  const ledgerSheet = workbook.getWorksheet(SHEET_LEDGER);
  const tripSheet = workbook.getWorksheet(SHEET_TRIPS);
  const vehicleIndexSheet = workbook.getWorksheet(SHEET_VEHICLE_INDEX);

  for (const [name, sheet] of [
    [SHEET_CUSTOMER, customerSheet],
    [SHEET_VEHICLE, vehicleSheet],
    [SHEET_PRICE, priceSheet],
    [SHEET_FINANCE, financeSheet],
    [SHEET_LEDGER, ledgerSheet],
    [SHEET_TRIPS, tripSheet],
  ] as const) {
    if (!sheet) warnings.push(`Không tìm thấy sheet "${name}" trong file Excel — phần dữ liệu này sẽ bị bỏ qua.`);
  }

  // ---- Khách hàng ----
  const customers: ParsedCustomer[] = [];
  const customerSeen = new Set<string>();
  if (customerSheet) {
    for (let r = 2; r <= customerSheet.rowCount; r++) {
      const row = customerSheet.getRow(r);
      const code = text(row.getCell(1).value);
      if (!code) continue;
      const key = normalizeKey(code);
      if (customerSeen.has(key)) {
        warnings.push(`Khách hàng dòng ${r}: mã "${code}" bị trùng trong file, chỉ lấy dòng đầu tiên.`);
        continue;
      }
      customerSeen.add(key);
      customers.push({
        code,
        name: text(row.getCell(2).value) || code,
        taxCode: text(row.getCell(3).value),
        address: text(row.getCell(4).value),
        phone: text(row.getCell(5).value),
        type: text(row.getCell(6).value),
      });
    }
  }

  // ---- Xe / Tài xế / ĐV vận tải (sheet DS XE) ----
  const vendorMap = new Map<string, ParsedVendor>();
  const driverMap = new Map<string, ParsedDriver>();
  const vehicles: ParsedVehicle[] = [];
  const vehicleSeen = new Set<string>();
  if (vehicleSheet) {
    for (let r = 2; r <= vehicleSheet.rowCount; r++) {
      const row = vehicleSheet.getRow(r);
      const licensePlate = text(row.getCell(2).value);
      const driverName = text(row.getCell(1).value);
      const vendorName = text(row.getCell(7).value);

      if (vendorName && !vendorMap.has(normalizeKey(vendorName))) {
        vendorMap.set(normalizeKey(vendorName), {
          code: sequentialCode("NCC", vendorMap.size + 1),
          name: vendorName,
        });
      }

      if (driverName && !driverMap.has(normalizeKey(driverName))) {
        driverMap.set(normalizeKey(driverName), {
          name: driverName,
          phone: text(row.getCell(4).value),
          licenseNumber: text(row.getCell(5).value),
          citizenId: text(row.getCell(6).value),
          baseSalary: num(row.getCell(8).value),
        });
      }

      if (!licensePlate) continue;
      if (vehicleSeen.has(normalizeKey(licensePlate))) {
        warnings.push(`Xe dòng ${r}: biển số "${licensePlate}" bị trùng trong file, chỉ lấy dòng đầu tiên.`);
        continue;
      }
      vehicleSeen.add(normalizeKey(licensePlate));
      vehicles.push({
        licensePlate,
        trailerNumber: text(row.getCell(3).value),
        phone: text(row.getCell(4).value),
        driverName,
        vendorName,
      });
    }
  }

  // ---- Điểm nâng/hạ, Hàng hóa, Bảng giá (sheet DS KH,Nâng,Hạ) ----
  const pickupNames = new Map<string, string>();
  const dropoffNames = new Map<string, string>();
  const productMap = new Map<string, ParsedProduct>();
  const prices: ParsedPrice[] = [];
  const priceCombos = new Map<string, number>();

  if (priceSheet) {
    for (let r = 2; r <= priceSheet.rowCount; r++) {
      const row = priceSheet.getRow(r);
      const customerCode = text(row.getCell(3).value);
      const pickupName = text(row.getCell(5).value);
      const dropoffName = text(row.getCell(6).value);
      const productKey = text(row.getCell(7).value);

      if (!customerCode && !pickupName && !dropoffName) continue;

      if (pickupName && !pickupNames.has(normalizeKey(pickupName))) {
        pickupNames.set(normalizeKey(pickupName), pickupName);
      }
      if (dropoffName && !dropoffNames.has(normalizeKey(dropoffName))) {
        dropoffNames.set(normalizeKey(dropoffName), dropoffName);
      }

      const { name: rawProductName, unit } = splitProductKey(productKey);
      const productName =
        rawProductName || (options.includeRowsWithoutProduct && customerCode && pickupName && dropoffName ? UNKNOWN_PRODUCT_NAME : "");
      if (productName && !productMap.has(normalizeKey(productName))) {
        productMap.set(normalizeKey(productName), {
          code: sequentialCode("HH", productMap.size + 1),
          name: productName,
          unit: unit || "Chuyến",
        });
      }

      if (!customerCode || !pickupName || !dropoffName || !productName) {
        warnings.push(
          `Bảng giá dòng ${r}: thiếu ${[
            !customerCode && "khách hàng",
            !pickupName && "điểm nâng",
            !dropoffName && "điểm hạ",
            !productName && "hàng hóa",
          ]
            .filter(Boolean)
            .join(", ")} — bỏ qua dòng này.`
        );
        continue;
      }

      const combo = [customerCode, pickupName, dropoffName, productName].map(normalizeKey).join("|");
      const seenCount = priceCombos.get(combo) ?? 0;
      if (seenCount > 0) {
        priceCombos.set(combo, seenCount + 1);
        warnings.push(
          `Bảng giá dòng ${r}: đã có mức giá khác cho "${customerCode} / ${pickupName} → ${dropoffName} / ${productName}" (giá ${num(
            row.getCell(8).value
          ).toLocaleString("vi-VN")}) — bỏ qua để tránh xung đột giá, cần kiểm tra lại thủ công.`
        );
        continue;
      }
      priceCombos.set(combo, 1);

      const money = {
        salesPrice: num(row.getCell(8).value),
        dropFee: num(row.getCell(9).value),
        vendorCost: num(row.getCell(10).value),
        driverTripSalary: num(row.getCell(11).value),
        ticketFee: num(row.getCell(12).value),
        // Cột 13 trong sheet gốc là "Dầu thực tế" (định mức tham chiếu), không phải "chi phí khác".
        fuelNormAmount: num(row.getCell(13).value),
      };

      if (Object.values(money).every((amount) => amount === 0)) {
        warnings.push(
          `Bảng giá dòng ${r}: không có giá trị tiền nào (đơn giá, hạ hàng, cước thuê... đều trống) — bỏ qua dòng này.`
        );
        continue;
      }

      prices.push({ customerCode, pickupName, dropoffName, productName, unit, ...money });
    }
  }

  // Gộp điểm nâng + điểm hạ thành 1 danh mục điểm, điểm nào xuất hiện ở cả 2 phía là BOTH.
  const locations: ParsedLocation[] = [];
  const allLocationKeys = new Set([...pickupNames.keys(), ...dropoffNames.keys()]);
  let locationIndex = 1;
  for (const key of allLocationKeys) {
    const isPickup = pickupNames.has(key);
    const isDropoff = dropoffNames.has(key);
    locations.push({
      code: sequentialCode("DIEM", locationIndex++),
      name: pickupNames.get(key) ?? dropoffNames.get(key) ?? key,
      type: isPickup && isDropoff ? "BOTH" : isPickup ? "PICKUP" : "DROPOFF",
    });
  }

  // ---- Loại chi phí (tiêu đề cột của sheet Thu - Chi, mỗi cột = 1 loại) ----
  const costTypeMap = new Map<string, ParsedCostType>();
  const financeTransactions: ParsedFinanceTransaction[] = [];
  const trips: ParsedTrip[] = [];
  const vehicleIndex = new Map<number, string>();
  if (vehicleSheet) {
    for (let r = 2; r <= vehicleSheet.rowCount; r++) {
      const id = num(vehicleSheet.getRow(r).getCell(9).value);
      const plate = text(vehicleSheet.getRow(r).getCell(2).value);
      if (id && plate) vehicleIndex.set(id, plate);
    }
  }
  if (vehicleIndexSheet && vehicleIndex.size === 0) {
    for (let r = 2; r <= vehicleIndexSheet.rowCount; r++) {
      const plate = text(vehicleIndexSheet.getRow(r).getCell(2).value);
      if (plate) vehicleIndex.set(r, plate);
    }
  }
  if (financeSheet) {
    const headerRow = financeSheet.getRow(2);
    const costHeaders = new Map<number, string>();
    for (let c = 1; c <= financeSheet.columnCount; c++) {
      const rawName = text(headerRow.getCell(c).value);
      const key = normalizeKey(rawName);
      if (!rawName || NON_COST_TYPE_HEADERS.has(key) || /^column\d+$/.test(key)) continue;
      costHeaders.set(c, rawName);
      if (costTypeMap.has(key)) continue;
      const flags = KNOWN_COST_TYPE_FLAGS[key] ?? { isTripCost: true };
      costTypeMap.set(key, {
        code: sequentialCode("CP", costTypeMap.size + 1),
        name: rawName,
        isFuel: flags.isFuel ?? false,
        isTripCost: flags.isTripCost ?? false,
        isCashTransaction: flags.isCashTransaction ?? false,
      });
    }

    // Mẫu 1.3 lưu phát sinh theo ma trận: cột ngày, đối tượng/diễn giải,
    // các cột còn lại là từng loại thu/chi. Mỗi ô số là một phiếu riêng.
    for (let r = 3; r <= financeSheet.rowCount && !ledgerSheet; r++) {
      const row = financeSheet.getRow(r);
      const transactionDate = text(row.getCell(1).value);
      if (!transactionDate) continue;
      const description = text(row.getCell(2).value);
      for (const [column, costTypeName] of costHeaders) {
        const amount = num(row.getCell(column).value);
        if (amount === 0) continue;
        const key = normalizeKey(costTypeName);
        const type: "RECEIPT" | "PAYMENT" =
          key.includes("thu tiền") || key.includes("thu ") || key === "nộp tiền" ? "RECEIPT" : "PAYMENT";
        financeTransactions.push({ transactionDate, type, costTypeName, amount, description });
      }
    }
  }

  if (ledgerSheet) {
    for (let r = 2; r <= ledgerSheet.rowCount; r++) {
      const row = ledgerSheet.getRow(r);
      const transactionDate = text(row.getCell(2).value);
      const amount = num(row.getCell(4).value);
      const costTypeName = text(row.getCell(5).value);
      if (!transactionDate || !amount || !costTypeName) continue;
      const objectValue = row.getCell(3).value;
      const objectNumber = typeof objectValue === "number" ? objectValue : Number(text(objectValue));
      financeTransactions.push({
        transactionDate,
        type: normalizeKey(costTypeName).includes("thu tiền") ? "RECEIPT" : "PAYMENT",
        costTypeName,
        amount,
        description: text(row.getCell(6).value),
        vehiclePlate: vehicleIndex.get(objectNumber),
      });
    }
  }

  if (tripSheet) {
    for (let r = 2; r <= tripSheet.rowCount; r++) {
      const row = tripSheet.getRow(r);
      const tripDate = text(row.getCell(1).value);
      const tripCode = text(row.getCell(4).value);
      const rawPlate = row.getCell(2).value;
      const vehiclePlate = typeof rawPlate === "number" ? vehicleIndex.get(rawPlate) ?? "" : text(rawPlate);
      const customerName = text(row.getCell(3).value);
      const pickupName = text(row.getCell(8).value);
      const dropoffName = text(row.getCell(9).value);
      if (!tripDate || !tripCode || (!vehiclePlate && !customerName)) continue;
      const costs: { costTypeName: string; amount: number }[] = [
        { costTypeName: "Tiền cơm", amount: num(row.getCell(28).value) },
        { costTypeName: "Bốc hàng", amount: num(row.getCell(29).value) },
        { costTypeName: "Vé", amount: num(row.getCell(30).value) },
        { costTypeName: "Vá vỏ", amount: num(row.getCell(31).value) },
        { costTypeName: "Đổ dầu", amount: num(row.getCell(32).value) },
        { costTypeName: "Chi phí khác", amount: num(row.getCell(33).value) },
      ]
        .filter((cost) => cost.amount !== 0)
        .map((cost) => cost);
      const items = [];
      for (let item = 0; item < 5; item++) {
        const productName = splitProductKey(text(row.getCell(11 + item * 3).value)).name;
        const quantity = num(row.getCell(12 + item * 3).value);
        const unitPrice = num(row.getCell(13 + item * 3).value);
        if (productName && (quantity || unitPrice)) items.push({ productName, quantity, unitPrice });
      }
      trips.push({
        tripCode,
        tripDate,
        vehiclePlate,
        customerName,
        vendorName: text(row.getCell(34).value),
        driverName: text(row.getCell(5).value),
        lot: text(row.getCell(7).value),
        pickupName,
        dropoffName,
        productName: items[0]?.productName ?? "",
        quantity: items[0]?.quantity ?? 0,
        unitPrice: items[0]?.unitPrice ?? 0,
        dropFee: num(row.getCell(26).value),
        driverTripSalary: num(row.getCell(27).value),
        vendorCost: num(row.getCell(35).value),
        revenue: num(row.getCell(36).value),
        cost: num(row.getCell(37).value),
        profit: num(row.getCell(36).value) - num(row.getCell(37).value),
        status: text(row.getCell(40).value),
        note: text(row.getCell(39).value),
        items,
        costs,
      });
    }
  }
  // Loại chi phí chỉ xuất hiện ở cột chi phí của sheet Nhật Trình (mục 8), không có trong Thu - Chi.
  for (const name of ["Tiền cơm", "Bốc hàng", "Vé"]) {
    const key = normalizeKey(name);
    if (costTypeMap.has(key)) continue;
    const flags = KNOWN_COST_TYPE_FLAGS[key] ?? { isTripCost: true };
    costTypeMap.set(key, {
      code: sequentialCode("CP", costTypeMap.size + 1),
      name,
      isFuel: flags.isFuel ?? false,
      isTripCost: flags.isTripCost ?? false,
      isCashTransaction: flags.isCashTransaction ?? false,
    });
  }

  return {
    customers,
    vendors: [...vendorMap.values()],
    drivers: [...driverMap.values()],
    vehicles,
    locations,
    products: [...productMap.values()],
    prices,
    costTypes: [...costTypeMap.values()],
    financeTransactions,
    trips,
    warnings,
  };
}
