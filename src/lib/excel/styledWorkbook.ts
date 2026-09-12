import ExcelJS from "exceljs";
import { getCompanyInfo } from "@/services/companyInfo";

/**
 * Style Excel xuất ra giống hệt file Excel gốc của doanh nghiệp (logo, con dấu, chữ ký, font Times New
 * Roman, căn giữa, định dạng số có phân cách nghìn, border bảng, tắt đường kẻ lưới) — dùng chung cho mọi
 * loại xuất Excel "có hình thức chứng từ" (Bảng lương, Báo giá, Bảng kê theo xe, Công nợ...), khác với
 * `genericExport.ts` (xuất Excel dữ liệu thô cho mọi màn hình danh sách). Thông tin công ty (tên/địa
 * chỉ/MST/ĐT/email/số TK/ngân hàng/giám đốc/logo/con dấu/chữ ký) lấy từ `services/companyInfo` — Admin
 * cấu hình qua trang "Thông tin công ty" (mục 35), không hard-code.
 */

export const EXCEL_FONT = "Times New Roman";
export const EXCEL_COLOR_RED = "FFFF0000";
export const EXCEL_COLOR_BLUE = "FF0000FF";
export const EXCEL_HIGHLIGHT_FILL = "FFFFB3AD";
/** Định dạng số có phân cách nghìn đúng như các cột tiền trong file Excel gốc (accounting `#,##0`). */
export const EXCEL_NUMBER_FORMAT = "#,##0";

/** Kích cỡ TỐI ĐA logo/con dấu/chữ ký (px) — ảnh thật luôn được co giữ đúng tỉ lệ gốc để vừa trong
 * khung này (`fitContain`), không bao giờ bị kéo giãn/méo. Chữ ký phải nhỏ hơn đáng kể và nằm gọn giữa
 * con dấu — không được che viền/rìa con dấu (kiểm tra hình học: nửa đường chéo chữ ký phải nhỏ hơn
 * bán kính con dấu, xem `addConfirmationFooter`). */
export const LOGO_SIZE = { width: 88, height: 88 };
export const SEAL_SIZE = { width: 150, height: 150 };
export const SIGNATURE_SIZE = { width: 75, height: 75 };

const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin" };
const ALL_BORDERS: Partial<ExcelJS.Borders> = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

async function fetchImageBuffer(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function extensionFromDataUrl(dataUrl: string): "png" | "jpeg" | "gif" {
  const match = /^data:image\/(png|jpe?g|gif)/i.exec(dataUrl);
  const ext = match?.[1]?.toLowerCase();
  if (ext === "jpg") return "jpeg";
  return (ext as "png" | "jpeg" | "gif" | undefined) ?? "png";
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Đọc kích thước gốc (px) từ header PNG (IHDR) — trả về null nếu không phải PNG hợp lệ. */
function parsePngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

/** Đọc kích thước gốc (px) từ marker SOF của JPEG — trả về null nếu không phải JPEG hợp lệ. */
function parseJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      return { width: view.getUint16(i + 7, false), height: view.getUint16(i + 5, false) };
    }
    const len = view.getUint16(i + 2, false);
    i += 2 + len;
  }
  return null;
}

/** Co (không phóng to) kích thước gốc để vừa khít trong `max`, giữ nguyên tỉ lệ — như CSS `object-fit:
 * contain`, tránh ảnh (logo/con dấu/chữ ký Admin tự tải lên) bị kéo méo khi tỉ lệ khác khung hiển thị. */
function fitContain(natural: { width: number; height: number }, max: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(max.width / natural.width, max.height / natural.height, 1);
  return { width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) };
}

/**
 * Thêm ảnh vào workbook và trả về `imageId` + kích thước hiển thị (đã co giữ tỉ lệ để vừa trong
 * `maxSize`) — ưu tiên ảnh Admin tự tải lên (data URL lưu ở `settings/company_info`), nếu chưa cấu
 * hình thì dùng ảnh mặc định trích từ file Excel gốc (`public/branding/`).
 */
async function loadCompanyImage(
  workbook: ExcelJS.Workbook,
  dataUrl: string | undefined,
  fallbackPath: string,
  fallbackExtension: "png" | "jpeg",
  maxSize: { width: number; height: number }
): Promise<{ imageId: number; width: number; height: number } | null> {
  let bytes: Uint8Array;
  let imageId: number;

  if (dataUrl) {
    bytes = base64ToBytes(dataUrl);
    imageId = workbook.addImage({ base64: dataUrl, extension: extensionFromDataUrl(dataUrl) });
  } else {
    const buffer = await fetchImageBuffer(fallbackPath);
    if (!buffer) return null;
    bytes = new Uint8Array(buffer);
    imageId = workbook.addImage({ buffer, extension: fallbackExtension });
  }

  const natural = parsePngSize(bytes) ?? parseJpegSize(bytes) ?? maxSize;
  const { width, height } = fitContain(natural, maxSize);
  return { imageId, width, height };
}

/** Độ rộng cột (đơn vị "ký tự" của Excel) → px, theo công thức chuẩn của Excel với font mặc định. */
function columnWidthPx(sheet: ExcelJS.Worksheet, col: number): number {
  return Math.round((sheet.getColumn(col).width ?? 8.43) * 7 + 5);
}

/** Chiều cao dòng (pt) → px (96 dpi). */
function rowHeightPx(sheet: ExcelJS.Worksheet, row: number): number {
  return Math.round(((sheet.getRow(row).height ?? 15) * 96) / 72);
}

/** 1 px ở 96dpi = 9525 EMU (đơn vị gốc OOXML dùng cho colOff/rowOff của ảnh). */
const EMU_PER_PX = 9525;

/**
 * Đổi toạ độ px (x tính từ mép trái sheet, y tính từ mép trên của `baseRow`) sang anchor `tl` dạng
 * native (nativeCol/nativeColOff/nativeRow/nativeRowOff tính thẳng bằng EMU) — KHÔNG dùng dạng
 * `{col: 5.239}` phân số của ExcelJS vì setter `col` của ExcelJS quy đổi phần lẻ sang EMU bằng công
 * thức riêng (`width * 10000`) sai khác nhiều lần so với công thức pixel chuẩn ở trên, khiến ảnh bị
 * lệch khỏi vị trí đã tính (đây là nguyên nhân chữ ký/con dấu bị lệch tâm ở lần trước). Dùng toạ độ
 * native + EMU tính trực tiếp thì không phụ thuộc cách ExcelJS quy đổi, luôn ra đúng vị trí.
 */
function pixelAnchor(sheet: ExcelJS.Worksheet, xPx: number, baseRow: number, yOffsetPx: number): { col: number; row: number } {
  let col = 1;
  let x = xPx;
  while (x >= columnWidthPx(sheet, col) && col < 200) {
    x -= columnWidthPx(sheet, col);
    col++;
  }
  let row = baseRow;
  let y = yOffsetPx;
  while (y >= rowHeightPx(sheet, row) && row < baseRow + 50) {
    y -= rowHeightPx(sheet, row);
    row++;
  }
  const nativeAnchor = {
    nativeCol: col - 1,
    nativeColOff: Math.round(x * EMU_PER_PX),
    nativeRow: row - 1,
    nativeRowOff: Math.round(y * EMU_PER_PX),
  };
  // ExcelJS's TS typing for `ImagePosition.tl` only declares {col, row}, but its runtime Anchor class
  // (lib/doc/anchor.js) also accepts this native/EMU shape directly (branch `nativeCol !== undefined`)
  // and serializes it as-is — the cast is safe, the fractional {col,row} shape is what's unreliable.
  return nativeAnchor as unknown as { col: number; row: number };
}

/** Khổ A4 (inch) trừ lề trái/phải 0.3in mỗi bên — khớp `margins` đặt trong `addLetterhead`. */
const USABLE_WIDTH_IN = { portrait: 8.27 - 0.6, landscape: 11.69 - 0.6 };

/**
 * Phóng đều độ rộng mọi cột (giữ nguyên tỉ lệ giữa các cột) để bảng lấp gần hết chiều ngang trang in —
 * tránh dư khoảng trắng lớn bên phải khi bảng có ít cột/cột hẹp (vd Bảng lương tài xế chỉ 4 cột, portrait
 * chỉ dùng ~78% khổ giấy). Chỉ PHÓNG TO, không bao giờ thu nhỏ — bảng đã quá khổ giấy tự co vừa nhờ
 * `fitToWidth` trong `pageSetup`, không cần xử lý ở đây.
 */
function fitColumnsToPage(sheet: ExcelJS.Worksheet, totalCols: number, orientation: "portrait" | "landscape") {
  let totalPx = 0;
  for (let c = 1; c <= totalCols; c++) totalPx += columnWidthPx(sheet, c);
  const usablePx = USABLE_WIDTH_IN[orientation] * 96;
  if (totalPx >= usablePx) return;
  const scale = usablePx / totalPx;
  for (let c = 1; c <= totalCols; c++) {
    const col = sheet.getColumn(c);
    col.width = (col.width ?? 8.43) * scale;
  }
}

function columnsSpanPx(sheet: ExcelJS.Worksheet, fromCol: number, toCol: number): { start: number; end: number } {
  let start = 0;
  for (let c = 1; c < fromCol; c++) start += columnWidthPx(sheet, c);
  let end = start;
  for (let c = fromCol; c <= toCol; c++) end += columnWidthPx(sheet, c);
  return { start, end };
}

type RichTextRun = { font?: Partial<ExcelJS.Font>; text: string };

/** Ghi 1 dòng rich-text nhiều màu/kiểu chữ vào ô đã merge, căn giữa cả ngang lẫn dọc — đúng cách file
 * gốc phối màu đỏ/đen trong cùng 1 dòng (vd "Mã số thuế : " đen + "0317938395" đỏ đậm). */
function writeRichTextLine(sheet: ExcelJS.Worksheet, row: number, fromCol: number, toCol: number, runs: RichTextRun[], baseSize: number) {
  sheet.mergeCells(row, fromCol, row, toCol);
  const cell = sheet.getCell(row, fromCol);
  cell.value = {
    richText: runs.map((r) => ({
      font: { name: EXCEL_FONT, size: baseSize, ...r.font },
      text: r.text,
    })),
  };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

/**
 * Logo công ty (góc trên trái) + khối thông tin công ty 4 dòng (Tên+Địa chỉ / MST / ĐT+Email / Số TK+
 * Ngân hàng, căn giữa, phối màu đỏ/đen từng đoạn) + tiêu đề chứng từ — đúng bố cục & màu sắc letterhead
 * trong file Excel gốc (rich-text nhiều màu trong cùng 1 dòng, không phải text thuần 1 màu). `options`
 * cho phép đổi màu/cỡ chữ tiêu đề (vd Báo giá dùng xanh cỡ lớn hơn mặc định đỏ). Trả về số dòng tiếp
 * theo còn trống.
 */
export async function addLetterhead(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  title: string,
  totalCols: number,
  options?: { titleColor?: string; titleSize?: number }
): Promise<number> {
  const cols = Math.max(totalCols, 4);
  const company = await getCompanyInfo();
  const size = 10;

  // File gốc luôn tắt hiển thị đường kẻ lưới (showGridLines: false) — xuất ra là 1 chứng từ, không
  // phải bảng tính; bảng dữ liệu tự có border riêng qua styleTableHeaderRow/styleDataRow.
  sheet.views = [{ showGridLines: false }];

  // Co vừa đúng 1 trang ngang khi in (fitToWidth: 1) — nếu không, bảng nhiều cột (vd Danh thu xe 9
  // cột, Công nợ 8 cột) sẽ tràn khổ giấy và bị CẮT MẤT nội dung bên phải (letterhead, khối xác nhận
  // công ty...) khi in/xuất PDF thay vì tự thu nhỏ vừa trang như Excel vẫn làm mặc định cho khổ hẹp.
  const orientation = cols > 6 ? "landscape" : "portrait";
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  // Chiều ngược lại: bảng ít cột/cột hẹp (vd Bảng lương chỉ 4 cột) không tự phóng to để lấp trang —
  // `fitToWidth` chỉ CO, không GIÃN — nên phải chủ động phóng cột ở đây, tránh dư khoảng trắng lớn.
  fitColumnsToPage(sheet, cols, orientation);

  const logo = await loadCompanyImage(workbook, company.logoDataUrl, "/branding/logo.png", "png", LOGO_SIZE);
  if (logo) {
    sheet.addImage(logo.imageId, { tl: pixelAnchor(sheet, 6, 1, 6), ext: { width: logo.width, height: logo.height } });
  }

  writeRichTextLine(
    sheet,
    1,
    2,
    cols,
    [
      { text: company.name, font: { bold: true, size: 13, color: { argb: EXCEL_COLOR_RED } } },
      { text: "\n" },
      { text: `Địa chỉ: ${company.address}`, font: { italic: true } },
    ],
    size
  );
  sheet.getRow(1).height = 34;

  writeRichTextLine(
    sheet,
    2,
    2,
    cols,
    [
      { text: "Mã số thuế: " },
      { text: company.taxCode, font: { bold: true, color: { argb: EXCEL_COLOR_RED } } },
    ],
    size
  );

  const line3: RichTextRun[] = [{ text: "Điện thoại: " }, { text: company.phone, font: { color: { argb: EXCEL_COLOR_RED } } }];
  if (company.email) {
    line3.push({ text: "     Email: " }, { text: company.email, font: { color: { argb: EXCEL_COLOR_RED } } });
  }
  writeRichTextLine(sheet, 3, 2, cols, line3, size);

  if (company.bankAccountNo || company.bankName) {
    const line4: RichTextRun[] = [{ text: "Số tài khoản: " }];
    if (company.bankAccountNo) line4.push({ text: company.bankAccountNo, font: { bold: true, color: { argb: EXCEL_COLOR_RED } } });
    if (company.bankName) line4.push({ text: " tại " }, { text: company.bankName, font: { bold: true, color: { argb: EXCEL_COLOR_RED } } });
    writeRichTextLine(sheet, 4, 2, cols, line4, size);
  }

  sheet.getRow(5).height = 8;

  sheet.mergeCells(6, 1, 6, cols);
  const titleCell = sheet.getCell(6, 1);
  titleCell.value = title.toLocaleUpperCase("vi-VN");
  titleCell.font = { name: EXCEL_FONT, size: options?.titleSize ?? 16, bold: true, color: { argb: options?.titleColor ?? EXCEL_COLOR_RED } };
  titleCell.alignment = { horizontal: "center" };
  sheet.getRow(6).height = 28;

  return 8;
}

/**
 * Ghi 1 dòng "nhãn: giá trị" đúng quy ước file gốc — nhãn ở cột 1 căn phải, giá trị merge từ cột 2
 * đến cột cuối căn trái, không border (khối thông tin trong file gốc không kẻ ô).
 */
export function writeLabelValueLine(
  sheet: ExcelJS.Worksheet,
  row: number,
  totalCols: number,
  label: string,
  value: string,
  options?: { valueBold?: boolean; valueColor?: string; size?: number }
) {
  const size = options?.size ?? 11;
  const labelCell = sheet.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { name: EXCEL_FONT, size, bold: true };
  labelCell.alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells(row, 2, row, totalCols);
  const valueCell = sheet.getCell(row, 2);
  valueCell.value = value;
  valueCell.font = {
    name: EXCEL_FONT,
    size,
    bold: options?.valueBold ?? false,
    color: options?.valueColor ? { argb: options.valueColor } : undefined,
  };
  valueCell.alignment = { horizontal: "left", vertical: "middle" };
}

/** Kẻ border mảnh 4 cạnh cho mọi ô của 1 dòng trong bảng dữ liệu — đúng như bảng trong file gốc. */
export function applyTableBorders(sheet: ExcelJS.Worksheet, row: number, totalCols: number) {
  for (let c = 1; c <= totalCols; c++) {
    sheet.getCell(row, c).border = ALL_BORDERS;
  }
}

/** Style chuẩn cho dòng tiêu đề bảng dữ liệu (đỏ đậm, căn giữa, wrap, border 4 cạnh) — đúng file gốc. */
export function styleTableHeaderRow(sheet: ExcelJS.Worksheet, row: number, totalCols: number) {
  for (let c = 1; c <= totalCols; c++) {
    const cell = sheet.getCell(row, c);
    cell.font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: EXCEL_COLOR_RED } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  applyTableBorders(sheet, row, totalCols);
}

/** Style 1 dải nổi bật (vd tên tài xế/khách hàng) — nền hồng nhạt, chữ đỏ đậm, đúng như file gốc. */
export function styleHighlightRow(sheet: ExcelJS.Worksheet, row: number, totalCols: number) {
  for (let c = 1; c <= totalCols; c++) {
    const cell = sheet.getCell(row, c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HIGHLIGHT_FILL } };
    cell.font = { name: EXCEL_FONT, size: 12, bold: true, color: { argb: EXCEL_COLOR_RED } };
  }
}

/** Style toàn bộ ô dữ liệu thường trong 1 dòng — Times New Roman, căn giữa, border 4 cạnh như file gốc. */
export function styleDataRow(sheet: ExcelJS.Worksheet, row: number, totalCols: number) {
  for (let c = 1; c <= totalCols; c++) {
    const cell = sheet.getCell(row, c);
    cell.font = { name: EXCEL_FONT, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  applyTableBorders(sheet, row, totalCols);
}

/**
 * Khối xác nhận cuối chứng từ — đúng bố cục DUY NHẤT mà cả 4 sheet gốc (Lương tài xế, Báo giá, Công
 * Nợ, Danh thu xe) đều dùng, không có khối "Người lập / Kế toán trưởng / Giám đốc":
 *
 *   | XÁC NHẬN CỦA {đối tượng}   | XÁC NHẬN CỦA CÔNG TY              |
 *   | (Ký và ghi rõ họ tên)      | TÊN CÔNG TY (đỏ đậm)              |
 *   |                            |   [con dấu + chữ ký, căn giữa]    |
 *   |                            | TÊN GIÁM ĐỐC (đỏ đậm)             |
 *
 * `partyLabel` đổi theo chứng từ: "XÁC NHẬN CỦA TÀI XẾ" (Lương tài xế, Danh thu xe), "XÁC NHẬN CỦA
 * KHÁCH HÀNG" (Báo giá, Công nợ KH), "XÁC NHẬN CỦA ĐƠN VỊ VẬN TẢI" (Công nợ ĐVVT). Con dấu vẽ trước,
 * chữ ký vẽ sau đè lên (chữ ký nằm trên dấu), cả 2 căn giữa theo px thực của các cột bên phải. Trả về
 * số dòng tiếp theo còn trống.
 */
export async function addConfirmationFooter(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  startRow: number,
  totalCols: number,
  partyLabel: string
): Promise<number> {
  const half = Math.max(Math.floor(totalCols / 2), 1);
  const rightFrom = half + 1;
  const rightTo = Math.max(totalCols, rightFrom);
  const company = await getCompanyInfo();

  const GAP_ROWS = 4;
  const gapRowHeight = 30;
  const titleRow = startRow;
  const nameRow = startRow + 1;
  const directorRow = nameRow + 1 + GAP_ROWS;

  const centered = (cell: ExcelJS.Cell) => {
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  };

  sheet.mergeCells(titleRow, 1, titleRow, half);
  const leftTitle = sheet.getCell(titleRow, 1);
  leftTitle.value = partyLabel.toLocaleUpperCase("vi-VN");
  leftTitle.font = { name: EXCEL_FONT, size: 12, bold: true };
  centered(leftTitle);

  sheet.mergeCells(titleRow, rightFrom, titleRow, rightTo);
  const rightTitle = sheet.getCell(titleRow, rightFrom);
  rightTitle.value = "XÁC NHẬN CỦA CÔNG TY";
  rightTitle.font = { name: EXCEL_FONT, size: 12, bold: true };
  centered(rightTitle);
  sheet.getRow(titleRow).height = 24;

  sheet.mergeCells(nameRow, 1, nameRow, half);
  const leftNote = sheet.getCell(nameRow, 1);
  leftNote.value = "(Ký và ghi rõ họ tên)";
  leftNote.font = { name: EXCEL_FONT, size: 10, italic: true };
  centered(leftNote);

  sheet.mergeCells(nameRow, rightFrom, nameRow, rightTo);
  const companyCell = sheet.getCell(nameRow, rightFrom);
  companyCell.value = company.name;
  companyCell.font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: EXCEL_COLOR_RED } };
  centered(companyCell);
  sheet.getRow(nameRow).height = 26;

  for (let r = nameRow + 1; r < directorRow; r++) {
    sheet.getRow(r).height = gapRowHeight;
  }

  if (company.directorName) {
    sheet.mergeCells(directorRow, rightFrom, directorRow, rightTo);
    const directorCell = sheet.getCell(directorRow, rightFrom);
    directorCell.value = company.directorName.toLocaleUpperCase("vi-VN");
    directorCell.font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: EXCEL_COLOR_RED } };
    centered(directorCell);
    sheet.getRow(directorRow).height = 22;
  }

  const seal = await loadCompanyImage(workbook, company.sealDataUrl, "/branding/seal.png", "png", SEAL_SIZE);
  const signature = await loadCompanyImage(workbook, company.signatureDataUrl, "/branding/signature.jpg", "jpeg", SIGNATURE_SIZE);

  const span = columnsSpanPx(sheet, rightFrom, rightTo);
  const centerX = (span.start + span.end) / 2;
  const gapTopRow = nameRow + 1;
  const gapHeightPx = GAP_ROWS * Math.round((gapRowHeight * 96) / 72);

  // Con dấu vẽ trước, chữ ký vẽ sau đè lên trên, cả 2 CĂN GIỮA đúng tâm con dấu (không lệch riêng) —
  // đúng thứ tự lớp ảnh trong file gốc và không để chữ ký che rìa dấu. Kích thước hiển thị lấy từ
  // `loadCompanyImage` (đã co giữ tỉ lệ ảnh thật), không dùng thẳng SEAL_SIZE/SIGNATURE_SIZE (chỉ là
  // khung tối đa) để tránh lệch tâm khi ảnh không vuông.
  if (seal) {
    const sealTopY = Math.max(0, Math.round((gapHeightPx - seal.height) / 2));
    const sealCenterY = sealTopY + seal.height / 2;
    sheet.addImage(seal.imageId, {
      tl: pixelAnchor(sheet, centerX - seal.width / 2, gapTopRow, sealTopY),
      ext: { width: seal.width, height: seal.height },
    });
    if (signature) {
      sheet.addImage(signature.imageId, {
        tl: pixelAnchor(sheet, centerX - signature.width / 2, gapTopRow, sealCenterY - signature.height / 2),
        ext: { width: signature.width, height: signature.height },
      });
    }
  } else if (signature) {
    const sigTopY = Math.max(0, Math.round((gapHeightPx - signature.height) / 2));
    sheet.addImage(signature.imageId, {
      tl: pixelAnchor(sheet, centerX - signature.width / 2, gapTopRow, sigTopY),
      ext: { width: signature.width, height: signature.height },
    });
  }

  return directorRow + 2;
}
