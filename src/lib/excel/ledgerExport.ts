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
  styleTableHeaderRow,
  writeLabelValueLine,
} from "@/lib/excel/styledWorkbook";
import { LedgerResult } from "@/services/finance";

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const TOTAL_COLS = 8; // STT | Ngày | Xe | Tuyến | Hàng hóa | Số tiền (thu/cước) | Đã thu/trả | Còn lại

export interface LedgerExportParams {
  /** "Bảng kê công nợ khách hàng" hoặc "Bảng kê công nợ đơn vị vận tải". */
  documentTitle: string;
  /** "Tên KH:" hoặc "Tên ĐV vận tải:". */
  partnerFieldLabel: string;
  partnerName: string;
  partnerTaxCode?: string;
  partnerAddress?: string;
  partnerPhone?: string;
  ledger: LedgerResult;
  vehiclePlate: (id: string) => string;
  locationName: (id: string) => string;
  productName: (id?: string) => string;
  /** "Tổng thu" (công nợ khách hàng) hoặc "Cước thuê" (công nợ đơn vị vận tải). */
  amountLabel: string;
  /** Giá trị cột tiền theo `amountLabel` — `trip.revenue` (khách hàng) hoặc `trip.vendorCost` (ĐV vận tải). */
  amountValue: (trip: LedgerResult["rows"][number]["trip"]) => number;
  /** "Đã thu" hoặc "Đã trả". */
  paidLabel: string;
  /** "XÁC NHẬN CỦA KHÁCH HÀNG" hoặc "XÁC NHẬN CỦA ĐƠN VỊ VẬN TẢI" — cột trái khối xác nhận. */
  confirmLeftLabel: string;
  fileName: string;
}

/**
 * Xuất Excel "Bảng kê công nợ" đúng bố cục sheet "Công Nợ" (nội bộ đặt tên "BẢNG KÊ CHI TIẾT") trong
 * file gốc: letterhead, khối thông tin đối tượng (Tên/MST/Địa chỉ/SĐT), bảng chi tiết từng chuyến có
 * border, và khối xác nhận 2 cột dùng chung (`addConfirmationFooter`) — khác "Xuất Excel" dữ liệu thô.
 */
export async function exportLedgerToExcel(params: LedgerExportParams) {
  const { ledger, vehiclePlate, locationName, productName } = params;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bảng kê");
  sheet.columns = [{ width: 6 }, { width: 12 }, { width: 14 }, { width: 30 }, { width: 20 }, { width: 16 }, { width: 16 }, { width: 16 }];

  let row = await addLetterhead(workbook, sheet, params.documentTitle, TOTAL_COLS);

  writeLabelValueLine(sheet, row, TOTAL_COLS, params.partnerFieldLabel, params.partnerName, {
    valueBold: true,
    valueColor: EXCEL_COLOR_RED,
    size: 12,
  });
  row++;

  if (params.partnerTaxCode) {
    writeLabelValueLine(sheet, row, TOTAL_COLS, "MST:", params.partnerTaxCode);
    row++;
  }
  if (params.partnerAddress) {
    writeLabelValueLine(sheet, row, TOTAL_COLS, "Địa chỉ:", params.partnerAddress);
    row++;
  }
  if (params.partnerPhone) {
    writeLabelValueLine(sheet, row, TOTAL_COLS, "SĐT:", params.partnerPhone);
    row++;
  }
  row++;

  const headers = ["STT", "Ngày", "Xe", "Tuyến", "Hàng hóa", params.amountLabel, params.paidLabel, "Còn lại"];
  headers.forEach((h, i) => (sheet.getCell(row, i + 1).value = h));
  styleTableHeaderRow(sheet, row, TOTAL_COLS);
  row++;

  ledger.rows.forEach((r, i) => {
    const amount = params.amountValue(r.trip);
    sheet.getCell(row, 1).value = i + 1;
    sheet.getCell(row, 2).value = r.trip.tripDate;
    sheet.getCell(row, 3).value = vehiclePlate(r.trip.vehicleId);
    sheet.getCell(row, 4).value = `${locationName(r.trip.pickupLocationId)} → ${locationName(r.trip.dropoffLocationId)}`;
    sheet.getCell(row, 5).value = productName(r.trip.items[0]?.productId);
    sheet.getCell(row, 6).value = amount;
    sheet.getCell(row, 7).value = r.paid;
    sheet.getCell(row, 8).value = r.remaining;
    styleDataRow(sheet, row, TOTAL_COLS);
    for (const c of [6, 7, 8]) sheet.getCell(row, c).numFmt = EXCEL_NUMBER_FORMAT;
    if (r.remaining > 0) sheet.getCell(row, 8).font = { name: EXCEL_FONT, size: 11, color: { argb: EXCEL_COLOR_RED } };
    row++;
  });

  sheet.mergeCells(row, 1, row, 5);
  sheet.getCell(row, 1).value = "Tổng cộng";
  sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 12, bold: true };
  sheet.getCell(row, 1).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell(row, 6).value = ledger.totalRevenue;
  sheet.getCell(row, 7).value = ledger.totalPaid;
  sheet.getCell(row, 8).value = ledger.balance;
  for (const c of [6, 7, 8]) {
    sheet.getCell(row, c).font = { name: EXCEL_FONT, size: 12, bold: true, color: { argb: EXCEL_COLOR_BLUE } };
    sheet.getCell(row, c).numFmt = EXCEL_NUMBER_FORMAT;
    sheet.getCell(row, c).alignment = { horizontal: "center", vertical: "middle" };
  }
  applyTableBorders(sheet, row, TOTAL_COLS);
  row += 2;

  if (ledger.unlinkedPayments > 0) {
    sheet.mergeCells(row, 1, row, TOTAL_COLS);
    sheet.getCell(row, 1).value = `Đã có ${currencyFormatter.format(ledger.unlinkedPayments)} thanh toán chung (không gắn chuyến cụ thể), đã trừ vào tổng công nợ ở trên.`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
    row += 2;
  }

  await addConfirmationFooter(workbook, sheet, row, TOTAL_COLS, params.confirmLeftLabel);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${params.fileName}.xlsx`);
}
