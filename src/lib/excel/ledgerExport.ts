import ExcelJS from "exceljs";
import { downloadBlob } from "@/lib/excel/genericImport";
import {
  addConfirmationFooter,
  addLetterhead,
  applyTableBorders,
  EXCEL_COLOR_BLUE,
  EXCEL_COLOR_RED,
  EXCEL_FONT,
  EXCEL_NUMBER_FORMAT,
  styleDataRow,
  styleHighlightRow,
  styleTableHeaderRow,
} from "@/lib/excel/styledWorkbook";
import { LedgerResult } from "@/services/finance";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export interface PartnerLedgerItem {
  partnerId: string;
  partnerName: string;
  partnerCode?: string;
  partnerTaxCode?: string;
  partnerAddress?: string;
  partnerPhone?: string;
  ledger: LedgerResult;
}

export interface ExportCustomerLedgerParams {
  items: PartnerLedgerItem[];
  asOfDate?: string;
  onlyPartnerId?: string | null;
  vehiclePlate: (id: string) => string;
  locationName: (id: string) => string;
  productName: (id?: string) => string;
}

export interface ExportVendorLedgerParams {
  items: PartnerLedgerItem[];
  asOfDate?: string;
  onlyPartnerId?: string | null;
  vehiclePlate: (id: string) => string;
  locationName: (id: string) => string;
  productName: (id?: string) => string;
}

/** Chuyển định dạng yyyy-MM-dd sang dd/MM/yyyy để hiển thị người dùng */
function formatDateVi(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

/**
 * Ghi 2 cặp nhãn - giá trị cân đối trên bảng tính nhiều cột (13 - 14 cột).
 */
function writeLabelValuePairs(
  sheet: ExcelJS.Worksheet,
  row: number,
  totalCols: number,
  pairs: { label: string; value: string | number; isCurrency?: boolean; isHighlightValue?: boolean }[]
) {
  const mid = Math.floor(totalCols / 2);
  const ranges = [
    { labelColStart: 1, labelColEnd: 2, valColStart: 3, valColEnd: mid },
    { labelColStart: mid + 1, labelColEnd: mid + 2, valColStart: mid + 3, valColEnd: totalCols },
  ];

  pairs.forEach((pair, idx) => {
    const range = ranges[idx];
    if (!range) return;

    sheet.mergeCells(row, range.labelColStart, row, range.labelColEnd);
    const labelCell = sheet.getCell(row, range.labelColStart);
    labelCell.value = pair.label;
    labelCell.font = { name: EXCEL_FONT, size: 11, bold: true };
    labelCell.alignment = { horizontal: "right", vertical: "middle" };

    sheet.mergeCells(row, range.valColStart, row, range.valColEnd);
    const valCell = sheet.getCell(row, range.valColStart);
    valCell.value = pair.value;
    valCell.alignment = { horizontal: "left", vertical: "middle" };

    const isNum = typeof pair.value === "number";
    if (pair.isCurrency || isNum) {
      valCell.numFmt = EXCEL_NUMBER_FORMAT;
      valCell.font = {
        name: EXCEL_FONT,
        size: 11,
        bold: true,
        color: {
          argb: pair.isHighlightValue
            ? Number(pair.value) > 0
              ? EXCEL_COLOR_RED
              : EXCEL_COLOR_BLUE
            : EXCEL_COLOR_BLUE,
        },
      };
    } else {
      valCell.font = { name: EXCEL_FONT, size: 11 };
    }
  });
}

/** Ghi dòng địa chỉ tràn ngang các cột */
function writeFullAddressRow(sheet: ExcelJS.Worksheet, row: number, totalCols: number, label: string, address: string) {
  sheet.mergeCells(row, 1, row, 2);
  const labelCell = sheet.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { name: EXCEL_FONT, size: 11, bold: true };
  labelCell.alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells(row, 3, row, totalCols);
  const valCell = sheet.getCell(row, 3);
  valCell.value = address;
  valCell.font = { name: EXCEL_FONT, size: 11 };
  valCell.alignment = { horizontal: "left", vertical: "middle" };
}

/**
 * Xuất Excel Bảng kê công nợ khách hàng theo format chứng từ mẫu chuẩn (như Bảng lương tài xế):
 * - Letterhead doanh nghiệp đầy đủ (Logo, MST, SĐT, Email, STK)
 * - Tiêu đề BẢNG KÊ CÔNG NỢ KHÁCH HÀNG (đỏ đậm, 16pt)
 * - Mỗi khách hàng 1 dải nổi bật (nền hồng chữ đỏ)
 * - Khối tóm tắt thông tin đối tác & tài chính (MST, SĐT, Địa chỉ, Tổng phát sinh, Đã thanh toán, Thanh toán chung, Còn lại)
 * - Bảng chi tiết chuyến đầy đủ 14 cột nghiệp vụ (STT, Ngày, BKS, Điểm nâng, Điểm hạ, Lot, Hàng hóa, ĐVT, SL, Đơn giá, Hạ hàng, Tổng thu, Đã thu, Còn lại)
 * - Dòng tổng kết từng khách hàng và tổng cộng toàn kỳ
 * - Khối chữ ký 2 bên có con dấu công ty và chữ ký giám đốc
 */
export async function exportCustomerLedgerToExcel(params: ExportCustomerLedgerParams) {
  const { asOfDate, vehiclePlate, locationName, productName, onlyPartnerId } = params;
  const items = onlyPartnerId ? params.items.filter((i) => i.partnerId === onlyPartnerId) : params.items;

  const TOTAL_COLS = 14;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Công nợ KH");

  sheet.columns = [
    { width: 6 },  // 1: STT
    { width: 12 }, // 2: Ngày
    { width: 13 }, // 3: BKS
    { width: 20 }, // 4: Điểm nâng
    { width: 20 }, // 5: Điểm hạ
    { width: 12 }, // 6: Lot
    { width: 18 }, // 7: Hàng hóa
    { width: 8 },  // 8: ĐVT
    { width: 9 },  // 9: SL
    { width: 14 }, // 10: Đơn giá
    { width: 13 }, // 11: Hạ hàng
    { width: 16 }, // 12: Tổng thu
    { width: 16 }, // 13: Đã thu
    { width: 16 }, // 14: Còn lại
  ];

  const title = onlyPartnerId && items[0]
    ? `Bảng kê công nợ khách hàng - ${items[0].partnerName}`
    : "Bảng kê công nợ khách hàng";

  let row = await addLetterhead(workbook, sheet, title, TOTAL_COLS);

  if (asOfDate) {
    sheet.getCell(row, 1).value = `Thời điểm chốt số liệu: Đến ngày ${formatDateVi(asOfDate)}`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
    row += 2;
  }

  const headers = [
    "STT", "Ngày", "BKS", "Điểm nâng", "Điểm hạ", "Lot", "Hàng hóa",
    "ĐVT", "SL", "Đơn giá", "Hạ hàng", "Tổng thu", "Đã thu", "Còn lại"
  ];

  for (const item of items) {
    // 1. Dải nổi bật tên khách hàng (nền hồng chữ đỏ)
    sheet.mergeCells(row, 1, row, TOTAL_COLS);
    sheet.getCell(row, 1).value = `Khách hàng: ${item.partnerName}${item.partnerCode ? ` (${item.partnerCode})` : ""}`;
    styleHighlightRow(sheet, row, TOTAL_COLS);
    row++;

    // 2. Thông tin đối tác & số liệu tóm tắt
    writeLabelValuePairs(sheet, row, TOTAL_COLS, [
      { label: "Mã số thuế:", value: item.partnerTaxCode || "-", isCurrency: false },
      { label: "Số điện thoại:", value: item.partnerPhone || "-", isCurrency: false },
    ]);
    row++;

    if (item.partnerAddress) {
      writeFullAddressRow(sheet, row, TOTAL_COLS, "Địa chỉ:", item.partnerAddress);
      row++;
    }

    writeLabelValuePairs(sheet, row, TOTAL_COLS, [
      { label: "Tổng phát sinh:", value: item.ledger.totalRevenue, isCurrency: true },
      { label: "Đã thanh toán:", value: item.ledger.totalPaid, isCurrency: true },
    ]);
    row++;

    writeLabelValuePairs(sheet, row, TOTAL_COLS, [
      { label: "Thanh toán chung:", value: item.ledger.unlinkedPayments, isCurrency: true },
      { label: "Còn lại:", value: item.ledger.balance, isCurrency: true, isHighlightValue: true },
    ]);
    row += 2;

    // 3. Tiêu đề bảng chi tiết chuyến
    headers.forEach((h, i) => (sheet.getCell(row, i + 1).value = h));
    styleTableHeaderRow(sheet, row, TOTAL_COLS);
    row++;

    let sumQuantity = 0;
    let sumDropFee = 0;
    let sumPaid = 0;
    let sumRemaining = 0;

    // 4. Các dòng chi tiết từng chuyến
    item.ledger.rows.forEach((r, idx) => {
      const trip = r.trip;
      const firstItem = trip.items[0];
      const qty = firstItem?.quantity ?? 0;
      const unitPrice = firstItem?.unitPrice ?? 0;
      const dropFee = firstItem?.dropFee ?? 0;
      const revenue = trip.revenue ?? 0;

      sumQuantity += qty;
      sumDropFee += dropFee;
      sumPaid += r.paid;
      sumRemaining += r.remaining;

      sheet.getCell(row, 1).value = idx + 1;
      sheet.getCell(row, 2).value = trip.tripDate;
      sheet.getCell(row, 3).value = vehiclePlate(trip.vehicleId);
      sheet.getCell(row, 4).value = locationName(trip.pickupLocationId);
      sheet.getCell(row, 5).value = locationName(trip.dropoffLocationId);
      sheet.getCell(row, 6).value = trip.lot ?? "";
      sheet.getCell(row, 7).value = productName(firstItem?.productId);
      sheet.getCell(row, 8).value = firstItem?.unit ?? "";
      sheet.getCell(row, 9).value = qty;
      sheet.getCell(row, 10).value = unitPrice;
      sheet.getCell(row, 11).value = dropFee;
      sheet.getCell(row, 12).value = revenue;
      sheet.getCell(row, 13).value = r.paid;
      sheet.getCell(row, 14).value = r.remaining;

      styleDataRow(sheet, row, TOTAL_COLS);

      for (const colIdx of [9, 10, 11, 12, 13, 14]) {
        const cell = sheet.getCell(row, colIdx);
        cell.numFmt = EXCEL_NUMBER_FORMAT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }

      if (r.remaining > 0) {
        sheet.getCell(row, 14).font = { name: EXCEL_FONT, size: 11, color: { argb: EXCEL_COLOR_RED }, bold: true };
      }

      row++;
    });

    // 5. Dòng tổng kết cho khách hàng này
    sheet.mergeCells(row, 1, row, 8);
    sheet.getCell(row, 1).value = `Tổng cộng (${item.ledger.rows.length} chuyến):`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 11, bold: true };
    sheet.getCell(row, 1).alignment = { horizontal: "right", vertical: "middle" };

    sheet.getCell(row, 9).value = sumQuantity;
    sheet.getCell(row, 11).value = sumDropFee;
    sheet.getCell(row, 12).value = item.ledger.totalRevenue;
    sheet.getCell(row, 13).value = sumPaid;
    sheet.getCell(row, 14).value = sumRemaining;

    for (const colIdx of [9, 11, 12, 13, 14]) {
      const cell = sheet.getCell(row, colIdx);
      cell.font = {
        name: EXCEL_FONT,
        size: 11,
        bold: true,
        color: { argb: colIdx === 14 && sumRemaining > 0 ? EXCEL_COLOR_RED : EXCEL_COLOR_BLUE },
      };
      cell.numFmt = EXCEL_NUMBER_FORMAT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
    applyTableBorders(sheet, row, TOTAL_COLS);
    row++;

    if (item.ledger.unlinkedPayments > 0) {
      sheet.mergeCells(row, 1, row, TOTAL_COLS);
      sheet.getCell(row, 1).value = `* Đã có ${currencyFormatter.format(item.ledger.unlinkedPayments)} thanh toán chung (không gắn chuyến cụ thể), đã trừ vào tổng công nợ còn lại ở trên.`;
      sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
      row++;
    }

    row += 2;
  }

  // 6. Dòng tổng cộng hợp nhất toàn bộ nếu xuất nhiều khách hàng
  if (!onlyPartnerId && items.length > 1) {
    sheet.mergeCells(row, 1, row, 11);
    sheet.getCell(row, 1).value = `Tổng cộng toàn bộ (${items.length} khách hàng):`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 12, bold: true };
    sheet.getCell(row, 1).alignment = { horizontal: "right", vertical: "middle" };

    const grandRevenue = items.reduce((sum, i) => sum + i.ledger.totalRevenue, 0);
    const grandPaid = items.reduce((sum, i) => sum + i.ledger.totalPaid, 0);
    const grandBalance = items.reduce((sum, i) => sum + i.ledger.balance, 0);

    sheet.getCell(row, 12).value = grandRevenue;
    sheet.getCell(row, 13).value = grandPaid;
    sheet.getCell(row, 14).value = grandBalance;

    for (const colIdx of [12, 13, 14]) {
      const cell = sheet.getCell(row, colIdx);
      cell.font = {
        name: EXCEL_FONT,
        size: 12,
        bold: true,
        color: { argb: colIdx === 14 && grandBalance > 0 ? EXCEL_COLOR_RED : EXCEL_COLOR_BLUE },
      };
      cell.numFmt = EXCEL_NUMBER_FORMAT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
    applyTableBorders(sheet, row, TOTAL_COLS);
    row += 2;
  }

  // 7. Khối xác nhận chữ ký 2 bên
  await addConfirmationFooter(workbook, sheet, row, TOTAL_COLS, "Xác nhận của khách hàng");

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const rawFileName = onlyPartnerId && items[0]
    ? `cong-no-khach-hang-${items[0].partnerName}${asOfDate ? `-${asOfDate}` : ""}`
    : `bang-ke-cong-no-khach-hang${asOfDate ? `-${asOfDate}` : ""}`;
  downloadBlob(blob, `${rawFileName.replace(/[\s/\\:*?"<>|]+/g, "_")}.xlsx`);
}

/**
 * Xuất Excel Bảng kê công nợ đơn vị vận tải theo format chứng từ mẫu chuẩn (như Bảng lương tài xế):
 * - Letterhead doanh nghiệp đầy đủ (Logo, MST, SĐT, Email, STK)
 * - Tiêu đề BẢNG KÊ CÔNG NỢ ĐƠN VỊ VẬN TẢI (đỏ đậm, 16pt)
 * - Mỗi đơn vị vận tải 1 dải nổi bật (nền hồng chữ đỏ)
 * - Khối tóm tắt thông tin đối tác & tài chính (MST, SĐT, Địa chỉ, Tổng cước thuê, Đã thanh toán, Thanh toán chung, Còn lại)
 * - Bảng chi tiết chuyến đầy đủ 13 cột nghiệp vụ (STT, Ngày, BKS, Điểm nâng, Điểm hạ, Hàng hóa, ĐVT, SL, Hạ hàng, Cước thuê, Đã trả, Còn lại, Nội dung)
 * - Dòng tổng kết từng đơn vị vận tải và tổng cộng toàn kỳ
 * - Khối chữ ký 2 bên có con dấu công ty và chữ ký giám đốc
 */
export async function exportVendorLedgerToExcel(params: ExportVendorLedgerParams) {
  const { asOfDate, vehiclePlate, locationName, productName, onlyPartnerId } = params;
  const items = onlyPartnerId ? params.items.filter((i) => i.partnerId === onlyPartnerId) : params.items;

  const TOTAL_COLS = 13;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Công nợ ĐVVT");

  sheet.columns = [
    { width: 6 },  // 1: STT
    { width: 12 }, // 2: Ngày
    { width: 13 }, // 3: BKS
    { width: 20 }, // 4: Điểm nâng
    { width: 20 }, // 5: Điểm hạ
    { width: 18 }, // 6: Hàng hóa
    { width: 8 },  // 7: ĐVT
    { width: 9 },  // 8: SL
    { width: 13 }, // 9: Hạ hàng
    { width: 16 }, // 10: Cước thuê
    { width: 16 }, // 11: Đã trả
    { width: 16 }, // 12: Còn lại
    { width: 22 }, // 13: Nội dung
  ];

  const title = onlyPartnerId && items[0]
    ? `Bảng kê công nợ đơn vị vận tải - ${items[0].partnerName}`
    : "Bảng kê công nợ đơn vị vận tải";

  let row = await addLetterhead(workbook, sheet, title, TOTAL_COLS);

  if (asOfDate) {
    sheet.getCell(row, 1).value = `Thời điểm chốt số liệu: Đến ngày ${formatDateVi(asOfDate)}`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
    row += 2;
  }

  const headers = [
    "STT", "Ngày", "BKS", "Điểm nâng", "Điểm hạ", "Hàng hóa",
    "ĐVT", "SL", "Hạ hàng", "Cước thuê", "Đã trả", "Còn lại", "Nội dung"
  ];

  for (const item of items) {
    // 1. Dải nổi bật tên đơn vị vận tải (nền hồng chữ đỏ)
    sheet.mergeCells(row, 1, row, TOTAL_COLS);
    sheet.getCell(row, 1).value = `Đơn vị vận tải: ${item.partnerName}${item.partnerCode ? ` (${item.partnerCode})` : ""}`;
    styleHighlightRow(sheet, row, TOTAL_COLS);
    row++;

    // 2. Thông tin đối tác & số liệu tóm tắt
    writeLabelValuePairs(sheet, row, TOTAL_COLS, [
      { label: "Mã số thuế:", value: item.partnerTaxCode || "-", isCurrency: false },
      { label: "Số điện thoại:", value: item.partnerPhone || "-", isCurrency: false },
    ]);
    row++;

    if (item.partnerAddress) {
      writeFullAddressRow(sheet, row, TOTAL_COLS, "Địa chỉ:", item.partnerAddress);
      row++;
    }

    writeLabelValuePairs(sheet, row, TOTAL_COLS, [
      { label: "Tổng cước thuê:", value: item.ledger.totalRevenue, isCurrency: true },
      { label: "Đã thanh toán:", value: item.ledger.totalPaid, isCurrency: true },
    ]);
    row++;

    writeLabelValuePairs(sheet, row, TOTAL_COLS, [
      { label: "Thanh toán chung:", value: item.ledger.unlinkedPayments, isCurrency: true },
      { label: "Còn lại:", value: item.ledger.balance, isCurrency: true, isHighlightValue: true },
    ]);
    row += 2;

    // 3. Tiêu đề bảng chi tiết chuyến
    headers.forEach((h, i) => (sheet.getCell(row, i + 1).value = h));
    styleTableHeaderRow(sheet, row, TOTAL_COLS);
    row++;

    let sumQuantity = 0;
    let sumDropFee = 0;
    let sumPaid = 0;
    let sumRemaining = 0;

    // 4. Các dòng chi tiết từng chuyến
    item.ledger.rows.forEach((r, idx) => {
      const trip = r.trip;
      const firstItem = trip.items[0];
      const qty = firstItem?.quantity ?? 0;
      const dropFee = firstItem?.dropFee ?? 0;
      const vendorCost = trip.vendorCost ?? 0;

      sumQuantity += qty;
      sumDropFee += dropFee;
      sumPaid += r.paid;
      sumRemaining += r.remaining;

      sheet.getCell(row, 1).value = idx + 1;
      sheet.getCell(row, 2).value = trip.tripDate;
      sheet.getCell(row, 3).value = vehiclePlate(trip.vehicleId);
      sheet.getCell(row, 4).value = locationName(trip.pickupLocationId);
      sheet.getCell(row, 5).value = locationName(trip.dropoffLocationId);
      sheet.getCell(row, 6).value = productName(firstItem?.productId);
      sheet.getCell(row, 7).value = firstItem?.unit ?? "";
      sheet.getCell(row, 8).value = qty;
      sheet.getCell(row, 9).value = dropFee;
      sheet.getCell(row, 10).value = vendorCost;
      sheet.getCell(row, 11).value = r.paid;
      sheet.getCell(row, 12).value = r.remaining;
      sheet.getCell(row, 13).value = trip.note ?? "";

      styleDataRow(sheet, row, TOTAL_COLS);

      for (const colIdx of [8, 9, 10, 11, 12]) {
        const cell = sheet.getCell(row, colIdx);
        cell.numFmt = EXCEL_NUMBER_FORMAT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }

      if (r.remaining > 0) {
        sheet.getCell(row, 12).font = { name: EXCEL_FONT, size: 11, color: { argb: EXCEL_COLOR_RED }, bold: true };
      }

      row++;
    });

    // 5. Dòng tổng kết cho đơn vị vận tải này
    sheet.mergeCells(row, 1, row, 7);
    sheet.getCell(row, 1).value = `Tổng cộng (${item.ledger.rows.length} chuyến):`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 11, bold: true };
    sheet.getCell(row, 1).alignment = { horizontal: "right", vertical: "middle" };

    sheet.getCell(row, 8).value = sumQuantity;
    sheet.getCell(row, 9).value = sumDropFee;
    sheet.getCell(row, 10).value = item.ledger.totalRevenue;
    sheet.getCell(row, 11).value = sumPaid;
    sheet.getCell(row, 12).value = sumRemaining;

    for (const colIdx of [8, 9, 10, 11, 12]) {
      const cell = sheet.getCell(row, colIdx);
      cell.font = {
        name: EXCEL_FONT,
        size: 11,
        bold: true,
        color: { argb: colIdx === 12 && sumRemaining > 0 ? EXCEL_COLOR_RED : EXCEL_COLOR_BLUE },
      };
      cell.numFmt = EXCEL_NUMBER_FORMAT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
    applyTableBorders(sheet, row, TOTAL_COLS);
    row++;

    if (item.ledger.unlinkedPayments > 0) {
      sheet.mergeCells(row, 1, row, TOTAL_COLS);
      sheet.getCell(row, 1).value = `* Đã có ${currencyFormatter.format(item.ledger.unlinkedPayments)} thanh toán chung (không gắn chuyến cụ thể), đã trừ vào tổng công nợ còn lại ở trên.`;
      sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
      row++;
    }

    row += 2;
  }

  // 6. Dòng tổng cộng hợp nhất toàn bộ nếu xuất nhiều ĐVVT
  if (!onlyPartnerId && items.length > 1) {
    sheet.mergeCells(row, 1, row, 9);
    sheet.getCell(row, 1).value = `Tổng cộng toàn bộ (${items.length} đơn vị vận tải):`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 12, bold: true };
    sheet.getCell(row, 1).alignment = { horizontal: "right", vertical: "middle" };

    const grandVendorCost = items.reduce((sum, i) => sum + i.ledger.totalRevenue, 0);
    const grandPaid = items.reduce((sum, i) => sum + i.ledger.totalPaid, 0);
    const grandBalance = items.reduce((sum, i) => sum + i.ledger.balance, 0);

    sheet.getCell(row, 10).value = grandVendorCost;
    sheet.getCell(row, 11).value = grandPaid;
    sheet.getCell(row, 12).value = grandBalance;

    for (const colIdx of [10, 11, 12]) {
      const cell = sheet.getCell(row, colIdx);
      cell.font = {
        name: EXCEL_FONT,
        size: 12,
        bold: true,
        color: { argb: colIdx === 12 && grandBalance > 0 ? EXCEL_COLOR_RED : EXCEL_COLOR_BLUE },
      };
      cell.numFmt = EXCEL_NUMBER_FORMAT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
    applyTableBorders(sheet, row, TOTAL_COLS);
    row += 2;
  }

  // 7. Khối xác nhận chữ ký 2 bên
  await addConfirmationFooter(workbook, sheet, row, TOTAL_COLS, "Xác nhận của đơn vị vận tải");

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const rawFileName = onlyPartnerId && items[0]
    ? `cong-no-don-vi-van-tai-${items[0].partnerName}${asOfDate ? `-${asOfDate}` : ""}`
    : `bang-ke-cong-no-don-vi-van-tai${asOfDate ? `-${asOfDate}` : ""}`;
  downloadBlob(blob, `${rawFileName.replace(/[\s/\\:*?"<>|]+/g, "_")}.xlsx`);
}

/** Interface tương thích ngược */
export interface LedgerExportParams {
  documentTitle: string;
  partnerFieldLabel: string;
  partnerName: string;
  partnerTaxCode?: string;
  partnerAddress?: string;
  partnerPhone?: string;
  ledger: LedgerResult;
  vehiclePlate: (id: string) => string;
  locationName: (id: string) => string;
  productName: (id?: string) => string;
  amountLabel: string;
  amountValue: (trip: LedgerResult["rows"][number]["trip"]) => number;
  paidLabel: string;
  confirmLeftLabel: string;
  fileName: string;
}

/** Wrapper tương thích ngược */
export async function exportLedgerToExcel(params: LedgerExportParams) {
  const isCustomer = params.confirmLeftLabel.toUpperCase().includes("KHÁCH HÀNG");
  const item: PartnerLedgerItem = {
    partnerId: "single",
    partnerName: params.partnerName,
    partnerTaxCode: params.partnerTaxCode,
    partnerAddress: params.partnerAddress,
    partnerPhone: params.partnerPhone,
    ledger: params.ledger,
  };

  if (isCustomer) {
    await exportCustomerLedgerToExcel({
      items: [item],
      onlyPartnerId: "single",
      vehiclePlate: params.vehiclePlate,
      locationName: params.locationName,
      productName: params.productName,
    });
  } else {
    await exportVendorLedgerToExcel({
      items: [item],
      onlyPartnerId: "single",
      vehiclePlate: params.vehiclePlate,
      locationName: params.locationName,
      productName: params.productName,
    });
  }
}

