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
import { computePayrollPeriodTotals, PayrollPeriodTotals } from "@/services/payroll";
import { PayrollItem, PayrollPeriod } from "@/types/payroll";
import { Trip } from "@/types/trip";

const TOTAL_COLS = 4; // Mã chuyến | Ngày | Tuyến | Lương chuyến

function writeLabelValueRow(sheet: ExcelJS.Worksheet, row: number, pairs: { label: string; value: number }[]) {
  let col = 1;
  for (const { label, value } of pairs) {
    const labelCell = sheet.getCell(row, col);
    labelCell.value = label;
    labelCell.font = { name: EXCEL_FONT, size: 11, bold: true };
    const valueCell = sheet.getCell(row, col + 1);
    valueCell.value = value;
    valueCell.font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: EXCEL_COLOR_BLUE } };
    valueCell.numFmt = EXCEL_NUMBER_FORMAT;
    col += 2;
  }
}

/**
 * Xuất Excel bảng lương tài xế theo đúng bố cục file gốc (mục 25-27): mỗi tài xế 1 dải nổi bật (tên
 * tài xế, nền hồng) + bảng con liệt kê từng chuyến đã tính vào lương, có logo/con dấu/chữ ký/màu sắc
 * giống hệt letterhead gốc — không phải xuất dữ liệu thô như "Xuất Excel" chung của DataTable.
 * `onlyDriverId` = xuất riêng phiếu lương 1 tài xế (khớp nút "In phiếu" từng dòng).
 */
export async function exportPayrollPeriodToExcel(params: {
  period: PayrollPeriod;
  items: PayrollItem[];
  tripsById: Record<string, Trip>;
  driverName: (id: string) => string;
  routeName: (trip: Trip) => string;
  onlyDriverId?: string | null;
}) {
  const { period, tripsById, driverName, routeName, onlyDriverId } = params;
  const items = onlyDriverId ? params.items.filter((i) => i.driverId === onlyDriverId) : params.items;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bảng lương");
  sheet.columns = [{ width: 18 }, { width: 14 }, { width: 32 }, { width: 16 }];

  const title = onlyDriverId
    ? `Phiếu lương - ${driverName(onlyDriverId)} - Kỳ ${period.periodCode}`
    : `Bảng lương tài xế - Kỳ ${period.periodCode}`;
  let row = await addLetterhead(workbook, sheet, title, TOTAL_COLS);

  sheet.getCell(row, 1).value = `Từ ngày ${period.fromDate} đến ngày ${period.toDate}`;
  sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
  row += 2;

  for (const item of items) {
    sheet.mergeCells(row, 1, row, TOTAL_COLS);
    sheet.getCell(row, 1).value = `Tài xế: ${driverName(item.driverId)}`;
    styleHighlightRow(sheet, row, TOTAL_COLS);
    row++;

    writeLabelValueRow(sheet, row, [
      { label: "Lương cơ bản:", value: item.baseSalary },
      { label: "Ứng lương:", value: item.advance },
    ]);
    row++;
    writeLabelValueRow(sheet, row, [
      { label: "Điều chỉnh:", value: item.adjustment },
      { label: "Thực nhận:", value: item.netAmount },
    ]);
    row += 2;

    sheet.getCell(row, 1).value = "Mã chuyến";
    sheet.getCell(row, 2).value = "Ngày";
    sheet.getCell(row, 3).value = "Tuyến";
    sheet.getCell(row, 4).value = "Lương chuyến";
    styleTableHeaderRow(sheet, row, TOTAL_COLS);
    row++;

    const trips = item.tripIds.map((id) => tripsById[id]).filter((t): t is Trip => Boolean(t));
    for (const trip of trips) {
      sheet.getCell(row, 1).value = trip.tripCode;
      sheet.getCell(row, 2).value = trip.tripDate;
      sheet.getCell(row, 3).value = routeName(trip);
      sheet.getCell(row, 4).value = trip.driverTripSalary || 0;
      styleDataRow(sheet, row, TOTAL_COLS);
      sheet.getCell(row, 4).numFmt = EXCEL_NUMBER_FORMAT;
      row++;
    }

    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = `Tổng lương chuyến (${trips.length} chuyến):`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 11, bold: true };
    sheet.getCell(row, 1).alignment = { horizontal: "right" };
    sheet.getCell(row, 4).value = item.tripSalary;
    sheet.getCell(row, 4).font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: EXCEL_COLOR_BLUE } };
    sheet.getCell(row, 4).numFmt = EXCEL_NUMBER_FORMAT;
    sheet.getCell(row, 4).alignment = { horizontal: "center", vertical: "middle" };
    applyTableBorders(sheet, row, TOTAL_COLS);
    row += 2;
  }

  if (!onlyDriverId) {
    const totals: PayrollPeriodTotals = computePayrollPeriodTotals(items);
    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = "Tổng cộng thực nhận toàn kỳ:";
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 12, bold: true };
    sheet.getCell(row, 1).alignment = { horizontal: "right" };
    sheet.getCell(row, 4).value = totals.totalNet;
    sheet.getCell(row, 4).font = { name: EXCEL_FONT, size: 12, bold: true, color: { argb: EXCEL_COLOR_BLUE } };
    sheet.getCell(row, 4).numFmt = EXCEL_NUMBER_FORMAT;
    row += 2;
  }

  await addConfirmationFooter(workbook, sheet, row, TOTAL_COLS, "Xác nhận của tài xế");

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, onlyDriverId ? `phieu-luong-${driverName(onlyDriverId)}-${period.periodCode}.xlsx` : `bang-luong-${period.periodCode}.xlsx`);
}
