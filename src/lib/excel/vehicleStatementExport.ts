import ExcelJS from "exceljs";
import { downloadBlob } from "@/lib/excel/genericImport";
import {
  addConfirmationFooter,
  addLetterhead,
  applyTableBorders,
  EXCEL_COLOR_BLUE,
  EXCEL_FONT,
  EXCEL_NUMBER_FORMAT,
  styleDataRow,
  styleHighlightRow,
  styleTableHeaderRow,
} from "@/lib/excel/styledWorkbook";
import { Trip } from "@/types/trip";

const TOTAL_COLS = 9; // Mã chuyến | Ngày | Tuyến | Cước thuê | Lương chuyến | Dầu thực tế | Chênh lệch dầu | Chi phí khác | Doanh thu

export interface VehicleStatementRow {
  trip: Trip;
  route: string;
  otherCost: number;
}

/**
 * Xuất Excel "BẢNG KÊ CHI TIẾT" đúng tên/bố cục sheet "Danh thu xe" trong file gốc: tiêu đề + dải
 * "BKS: {xe}" cùng dòng với "Tổng chi phí:" đặt NGAY TRÊN bảng (đúng vị trí file gốc — không phải
 * dải tên xe rồi tổng ở cuối) — bảng chi tiết từng chuyến bên dưới, tổng theo cột nhắc lại ở cuối
 * bảng cho tiện đối chiếu (file gốc không có, nhưng không mâu thuẫn — chỉ bổ sung thêm).
 */
export async function exportVehicleStatementToExcel(vehicleLabel: string, rows: VehicleStatementRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bảng kê");
  sheet.columns = [
    { width: 16 },
    { width: 12 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  let row = await addLetterhead(workbook, sheet, "Bảng kê chi tiết", TOTAL_COLS);

  let totalVendorCost = 0;
  let totalSalary = 0;
  let totalFuel = 0;
  let totalOther = 0;
  let totalRevenue = 0;
  for (const { trip, otherCost } of rows) {
    totalVendorCost += trip.vendorCost || 0;
    totalSalary += trip.driverTripSalary || 0;
    totalFuel += trip.fuelActualAmount || 0;
    totalOther += otherCost;
    totalRevenue += trip.revenue || 0;
  }
  const totalCost = totalVendorCost + totalSalary + totalFuel + totalOther;

  sheet.mergeCells(row, 1, row, 4);
  sheet.getCell(row, 1).value = `BKS: ${vehicleLabel}`;
  styleHighlightRow(sheet, row, 4);
  sheet.getCell(row, 5).value = "Tổng chi phí:";
  sheet.getCell(row, 5).font = { name: EXCEL_FONT, size: 12, bold: true };
  sheet.getCell(row, 5).alignment = { horizontal: "right", vertical: "middle" };
  sheet.mergeCells(row, 6, row, TOTAL_COLS);
  sheet.getCell(row, 6).value = totalCost;
  sheet.getCell(row, 6).numFmt = EXCEL_NUMBER_FORMAT;
  sheet.getCell(row, 6).font = { name: EXCEL_FONT, size: 12, bold: true, color: { argb: EXCEL_COLOR_BLUE } };
  row += 2;

  const headers = ["Mã chuyến", "Ngày", "Tuyến", "Cước thuê", "Lương chuyến", "Dầu thực tế", "Chênh lệch dầu", "Chi phí khác", "Doanh thu"];
  headers.forEach((h, i) => (sheet.getCell(row, i + 1).value = h));
  styleTableHeaderRow(sheet, row, TOTAL_COLS);
  row++;

  for (const { trip, route, otherCost } of rows) {
    sheet.getCell(row, 1).value = trip.tripCode;
    sheet.getCell(row, 2).value = trip.tripDate;
    sheet.getCell(row, 3).value = route;
    sheet.getCell(row, 4).value = trip.vendorCost || 0;
    sheet.getCell(row, 5).value = trip.driverTripSalary || 0;
    sheet.getCell(row, 6).value = trip.fuelActualAmount || 0;
    sheet.getCell(row, 7).value = trip.fuelVarianceAmount || 0;
    sheet.getCell(row, 8).value = otherCost;
    sheet.getCell(row, 9).value = trip.revenue || 0;
    styleDataRow(sheet, row, TOTAL_COLS);
    for (const c of [4, 5, 6, 7, 8, 9]) sheet.getCell(row, c).numFmt = EXCEL_NUMBER_FORMAT;
    row++;
  }

  sheet.getCell(row, 1).value = `Tổng cộng (${rows.length} chuyến)`;
  sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 11, bold: true };
  sheet.getCell(row, 4).value = totalVendorCost;
  sheet.getCell(row, 5).value = totalSalary;
  sheet.getCell(row, 6).value = totalFuel;
  sheet.getCell(row, 8).value = totalOther;
  sheet.getCell(row, 9).value = totalRevenue;
  for (const c of [4, 5, 6, 8, 9]) {
    sheet.getCell(row, c).font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: EXCEL_COLOR_BLUE } };
    sheet.getCell(row, c).numFmt = EXCEL_NUMBER_FORMAT;
    sheet.getCell(row, c).alignment = { horizontal: "center", vertical: "middle" };
  }
  applyTableBorders(sheet, row, TOTAL_COLS);
  row += 2;

  await addConfirmationFooter(workbook, sheet, row, TOTAL_COLS, "Xác nhận của tài xế");

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `bang-ke-${vehicleLabel.replace(/\s+/g, "-")}.xlsx`);
}
