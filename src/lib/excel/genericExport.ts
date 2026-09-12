import ExcelJS from "exceljs";
import { EXCEL_FONT } from "@/lib/excel/styledWorkbook";
import { downloadBlob } from "./genericImport";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

const HEADER_FILL = "FF4472C4"; // xanh chuẩn Excel (Accent 1) — dùng cho mọi bảng dữ liệu thô, khác
// màu đỏ/xanh riêng của từng loại chứng từ có letterhead (styledWorkbook.ts).
const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD0D0D0" } };
const ALL_BORDERS: Partial<ExcelJS.Borders> = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

/**
 * Xuất Excel dùng chung cho mọi màn hình danh sách (mục 35). Nhận đúng dữ liệu đã lọc (theo bộ lọc
 * cột/tìm kiếm/khoảng ngày đang áp dụng ở trang gọi) nên tự động đáp ứng cả 3 chế độ của mục 35
 * "Export tất cả / theo bộ lọc / theo khoảng thời gian" — không cần cài 3 nút riêng.
 *
 * Đây là kiểu xuất "dữ liệu thô" (khác các chứng từ có letterhead/logo/chữ ký ở `styledWorkbook.ts`)
 * nhưng vẫn cần định dạng tối thiểu để dùng được: header có màu nền + chữ trắng đậm, toàn bảng có
 * border, font đồng bộ Times New Roman, cột đủ rộng, khóa dòng tiêu đề khi cuộn — không xuất ra bảng
 * trần trụi không viền/không style như trước.
 */
export async function exportRowsToExcel<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, width: Math.max(c.header.length + 4, 14) }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const headerRow = sheet.getRow(1);
  headerRow.height = 20;
  for (let c = 1; c <= columns.length; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = ALL_BORDERS;
  }

  for (const row of rows) {
    const excelRow = sheet.addRow(columns.map((c) => c.value(row)));
    for (let c = 1; c <= columns.length; c++) {
      const cell = excelRow.getCell(c);
      cell.font = { name: EXCEL_FONT, size: 11 };
      cell.alignment = { vertical: "middle" };
      cell.border = ALL_BORDERS;
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, filename);
}
