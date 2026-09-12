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
import { Customer } from "@/types/master-data";
import { Quote } from "@/types/quote";

const TOTAL_COLS = 6; // Điểm nâng | Điểm hạ | Hàng hóa | ĐVT | SL | Đơn giá

/**
 * Xuất Excel báo giá đúng bố cục file gốc (sheet "Báo giá"): tiêu đề "BÁO GIÁ VẬN CHUYỂN" xanh đậm cỡ
 * lớn (khác cỡ/màu tiêu đề mặc định của `addLetterhead`, truyền qua `options`), khối thông tin khách
 * hàng (Tên KH/MST/Địa chỉ/SĐT), bảng chi tiết tuyến/hàng hóa/đơn giá, logo/con dấu/chữ ký lấy từ
 * `settings/company_info` — khác hẳn "Xuất Excel" dữ liệu thô dùng chung của DataTable.
 */
export async function exportQuoteToExcel(quote: Quote, customer: Customer | undefined, locationName: (id: string) => string, productName: (id: string) => string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Báo giá");
  sheet.columns = [{ width: 22 }, { width: 22 }, { width: 20 }, { width: 10 }, { width: 10 }, { width: 16 }];

  let row = await addLetterhead(workbook, sheet, "Báo giá vận chuyển", TOTAL_COLS, { titleColor: EXCEL_COLOR_BLUE, titleSize: 20 });

  writeLabelValueLine(sheet, row, TOTAL_COLS, "Số báo giá:", quote.quoteNo, { valueBold: true, valueColor: EXCEL_COLOR_RED });
  row++;
  writeLabelValueLine(sheet, row, TOTAL_COLS, "Ngày:", quote.quoteDate);
  row++;
  writeLabelValueLine(sheet, row, TOTAL_COLS, "Khách hàng:", customer?.name ?? "", { valueBold: true, valueColor: EXCEL_COLOR_RED });
  row++;

  if (customer?.address) {
    writeLabelValueLine(sheet, row, TOTAL_COLS, "Địa chỉ:", customer.address);
    row++;
  }

  writeLabelValueLine(sheet, row, TOTAL_COLS, "Hiệu lực:", `${quote.validFrom} - ${quote.validTo}`);
  row += 2;

  sheet.getCell(row, 1).value = "Điểm nâng";
  sheet.getCell(row, 2).value = "Điểm hạ";
  sheet.getCell(row, 3).value = "Hàng hóa";
  sheet.getCell(row, 4).value = "ĐVT";
  sheet.getCell(row, 5).value = "SL";
  sheet.getCell(row, 6).value = "Đơn giá";
  styleTableHeaderRow(sheet, row, TOTAL_COLS);
  row++;

  for (const item of quote.items) {
    sheet.getCell(row, 1).value = locationName(item.pickupLocationId);
    sheet.getCell(row, 2).value = locationName(item.dropoffLocationId);
    sheet.getCell(row, 3).value = productName(item.productId);
    sheet.getCell(row, 4).value = item.unit;
    sheet.getCell(row, 5).value = item.quantity;
    sheet.getCell(row, 6).value = item.unitPrice;
    styleDataRow(sheet, row, TOTAL_COLS);
    sheet.getCell(row, 6).font = { name: EXCEL_FONT, size: 11, color: { argb: EXCEL_COLOR_BLUE } };
    sheet.getCell(row, 6).numFmt = EXCEL_NUMBER_FORMAT;
    row++;
  }

  sheet.mergeCells(row, 1, row, 5);
  sheet.getCell(row, 1).value = "Tổng tiền báo giá:";
  sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 12, bold: true };
  sheet.getCell(row, 1).alignment = { horizontal: "right" };
  sheet.getCell(row, 6).value = quote.totalAmount;
  sheet.getCell(row, 6).font = { name: EXCEL_FONT, size: 12, bold: true, color: { argb: EXCEL_COLOR_RED } };
  sheet.getCell(row, 6).numFmt = EXCEL_NUMBER_FORMAT;
  sheet.getCell(row, 6).alignment = { horizontal: "center", vertical: "middle" };
  applyTableBorders(sheet, row, TOTAL_COLS);
  row += 2;

  if (quote.note) {
    sheet.getCell(row, 1).value = `Ghi chú: ${quote.note}`;
    sheet.getCell(row, 1).font = { name: EXCEL_FONT, size: 10, italic: true };
    row += 2;
  }

  await addConfirmationFooter(workbook, sheet, row, TOTAL_COLS, "Xác nhận của khách hàng");

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `bao-gia-${quote.quoteNo}.xlsx`);
}
