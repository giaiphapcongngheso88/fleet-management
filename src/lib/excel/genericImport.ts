import { format, isValid } from "date-fns";
import ExcelJS from "exceljs";

/**
 * Import Excel dùng chung cho từng trang danh mục (mục 34 đặc tả nghiệp vụ) — khác với
 * `masterDataParser.ts` (chỉ đọc đúng 1 file Excel gốc của doanh nghiệp, cột cố định theo vị trí).
 * Ở đây file mẫu do hệ thống tự sinh, khớp cột theo TÊN tiêu đề (không theo vị trí) nên người dùng
 * chèn/xóa cột thừa vẫn đọc đúng, miễn không đổi tên các cột bắt buộc.
 */
export interface ImportColumn<T> {
  key: keyof T & string;
  /** Tên cột hiển thị trong file mẫu — dùng để khớp cột khi đọc file người dùng tải lên. */
  header: string;
  required?: boolean;
  type?: "text" | "number" | "boolean" | "date";
  /** Giá trị gợi ý ở dòng ví dụ của file mẫu. */
  example?: string | number | boolean;
}

export interface ImportRowResult<T> {
  /** Số dòng trong file Excel (đã tính cả dòng tiêu đề) — dùng để báo lỗi đúng dòng (mục 34.3). */
  rowNumber: number;
  data: Partial<Record<keyof T, unknown>>;
  /** Lỗi tự phát hiện lúc đọc file (thiếu field bắt buộc) — trang gọi có thể bổ sung thêm lỗi nghiệp vụ. */
  errors: string[];
}

export interface ImportParseResult<T> {
  /** Sai định dạng file (thiếu cột bắt buộc, không đọc được file) — dừng ngay, không có rows. */
  formatError?: string;
  rows: ImportRowResult<T>[];
}

type CellValue = ExcelJS.CellValue;

function cellToText(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return isValid(value) ? format(value, "yyyy-MM-dd") : "";
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("").trim();
    }
    if ("result" in value && value.result != null) return cellToText(value.result as CellValue);
    if ("text" in value && value.text != null) return String(value.text).trim();
    return "";
  }
  return String(value).trim();
}

function cellToNumber(value: CellValue): number | undefined {
  const t = cellToText(value);
  if (!t) return undefined;
  const normalized = t.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function cellToBoolean(value: CellValue): boolean {
  const t = cellToText(value).toLowerCase();
  return ["1", "true", "x", "có", "yes"].includes(t);
}

/** Excel lưu ngày dạng số serial hoặc Date object tùy định dạng ô — luôn chuẩn hóa về "yyyy-MM-dd". */
function cellToDateString(value: CellValue): string {
  if (value instanceof Date) return isValid(value) ? format(value, "yyyy-MM-dd") : "";
  const t = cellToText(value);
  if (!t) return "";
  // Người dùng gõ tay dạng dd/MM/yyyy trong ô văn bản thuần (không phải ô ngày thực sự của Excel).
  const ddmmyyyy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return t;
}

/** Sinh file mẫu .xlsx (dòng tiêu đề + tối đa 1 dòng ví dụ) để người dùng tải về điền dữ liệu. */
export async function generateImportTemplate<T>(sheetName: string, columns: ImportColumn<T>[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({
    header: c.header + (c.required ? " (*)" : ""),
    key: c.key,
    width: Math.max(c.header.length + 6, 16),
  }));
  sheet.getRow(1).font = { bold: true };

  if (columns.some((c) => c.example !== undefined)) {
    const exampleRow: Record<string, unknown> = {};
    for (const c of columns) if (c.example !== undefined) exampleRow[c.key] = c.example;
    const row = sheet.addRow(exampleRow);
    row.font = { italic: true, color: { argb: "FF9CA3AF" } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Kích hoạt tải file xuống trình duyệt — dùng chung cho mọi nút "Tải file mẫu". */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Đọc file Excel người dùng tải lên, khớp cột theo tên tiêu đề (mục 34.1: Upload → Parse → Validate).
 * Trả lỗi định dạng ngay nếu thiếu cột bắt buộc hoặc không đọc được file — không cố đoán/suy diễn.
 */
export async function parseImportFile<T>(file: File, columns: ImportColumn<T>[]): Promise<ImportParseResult<T>> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { formatError: "Không đọc được file đã chọn.", rows: [] };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      formatError: 'File không đúng định dạng — vui lòng chọn đúng file Excel (.xlsx) được tải từ nút "Tải file mẫu".',
      rows: [],
    };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) {
    return { formatError: "File không có dữ liệu.", rows: [] };
  }

  const headerRow = sheet.getRow(1);
  const colIndexByHeader = new Map<string, number>();
  for (let c = 1; c <= sheet.columnCount; c++) {
    const raw = cellToText(headerRow.getCell(c).value).replace(/\s*\(\*\)\s*$/, "");
    if (raw) colIndexByHeader.set(raw.toLowerCase(), c);
  }

  const colIndexByKey = new Map<string, number>();
  for (const col of columns) {
    const idx = colIndexByHeader.get(col.header.toLowerCase());
    if (idx) colIndexByKey.set(col.key, idx);
  }

  const missingRequired = columns.filter((c) => c.required && !colIndexByKey.has(c.key));
  if (missingRequired.length > 0) {
    return {
      formatError: `File không đúng định dạng — thiếu cột bắt buộc: ${missingRequired
        .map((c) => c.header)
        .join(", ")}. Vui lòng tải lại "File mẫu" và điền đúng theo cột có sẵn, không đổi tên cột.`,
      rows: [],
    };
  }

  const rows: ImportRowResult<T>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const isEmptyRow = columns.every((c) => {
      const idx = colIndexByKey.get(c.key);
      return !idx || !cellToText(row.getCell(idx).value);
    });
    if (isEmptyRow) continue;

    const data: Partial<Record<keyof T, unknown>> = {};
    const errors: string[] = [];
    for (const col of columns) {
      const idx = colIndexByKey.get(col.key);
      const raw = idx ? row.getCell(idx).value : undefined;
      let value: unknown;
      if (col.type === "number") value = cellToNumber(raw);
      else if (col.type === "boolean") value = cellToBoolean(raw);
      else if (col.type === "date") value = cellToDateString(raw);
      else value = cellToText(raw);

      if (col.required && (value === undefined || value === "")) {
        errors.push(`Thiếu "${col.header}"`);
      }
      data[col.key] = value;
    }
    rows.push({ rowNumber: r, data, errors });
  }

  return { rows };
}
