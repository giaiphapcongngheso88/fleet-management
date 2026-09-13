"use client";

import { DATE_FORMAT, ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { InputDatePicker } from "@/components/ui/input-date-picker";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { parseMasterDataWorkbook, ParseResult } from "@/lib/excel/masterDataParser";
import { importMasterData, ImportResult } from "@/services/masterDataImport";
import { getErrorMessage } from "@/utils/errorHandler";
import { CANH_BAO } from "@/utils/enums";
import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";

const ENTITY_LABELS: { key: keyof ParseResult; label: string }[] = [
  { key: "customers", label: "Khách hàng" },
  { key: "vendors", label: "Đơn vị vận tải" },
  { key: "drivers", label: "Tài xế" },
  { key: "vehicles", label: "Xe" },
  { key: "locations", label: "Điểm nâng / hạ" },
  { key: "products", label: "Hàng hóa" },
  { key: "prices", label: "Bảng giá vận chuyển" },
  { key: "costTypes", label: "Loại chi phí" },
  { key: "financeTransactions", label: "Phiếu thu / chi" },
  { key: "trips", label: "Nhật trình / Chuyến xe" },
];

export default function ImportMasterDataPage() {
  const { alert, confirm } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const { can } = usePermission();
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState("2025-01-01");
  const [includeRowsWithoutProduct, setIncludeRowsWithoutProduct] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<string>("");

  const canImport = can("import", "IMPORT");

  const parseFile = async (file: File, withUnknownProduct: boolean) => {
    const loadingId = showLoading(ELoadingMessages.EXCEL_PROCESSING);
    try {
      const buffer = await file.arrayBuffer();
      const parseResult = await parseMasterDataWorkbook(buffer, {
        includeRowsWithoutProduct: withUnknownProduct,
      });
      setParsed(parseResult);
      const total = ENTITY_LABELS.reduce((sum, e) => sum + (parseResult[e.key] as unknown[]).length, 0);
      if (total === 0) {
        await alert({
          title: CANH_BAO,
          content: "Không đọc được dòng dữ liệu nào. Kiểm tra lại file có đúng các sheet: Khách hàng, DS XE, DS KH,Nâng,Hạ, Thu - Chi.",
        });
      }
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Đọc file Excel thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onSelectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParsed(null);
    setFileName(file.name);
    setSelectedFile(file);
    await parseFile(file, includeRowsWithoutProduct);
  };

  const onToggleUnknownProduct = async (checked: boolean) => {
    setIncludeRowsWithoutProduct(checked);
    if (selectedFile) {
      setResult(null);
      await parseFile(selectedFile, checked);
    }
  };

  const onImport = async () => {
    if (!parsed) return;
    const counts = ENTITY_LABELS.map((e) => `${e.label}: ${(parsed[e.key] as unknown[]).length}`).join("\n");
    const isConfirm = await confirm({
      title: "Xác nhận import dữ liệu",
      content: `Dữ liệu sau sẽ được ghi vào hệ thống:\n${counts}\n\nCác bản ghi đã tồn tại (theo mã / biển số / tên) sẽ được bỏ qua, không bị ghi đè. Tiếp tục?`,
    });
    if (!isConfirm) return;

    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const importResult = await importMasterData(parsed, {
        userId: user?.id ?? "",
        effectiveFrom,
        onProgress: setProgress,
      });
      setResult(importResult);
      const summary = ENTITY_LABELS.map((e) => {
        const counter = importResult[e.key as keyof ImportResult] as { created: number; skipped: number };
        return `${e.label}: thêm mới ${counter.created}, bỏ qua ${counter.skipped}`;
      }).join("\n");
      await alert({
        title: "Import hoàn tất",
        content: `${summary}${importResult.errors.length > 0 ? `\n\nCó ${importResult.errors.length} dòng lỗi, xem chi tiết bên dưới.` : ""}`,
      });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Import thất bại: " + getErrorMessage(err) });
    } finally {
      setProgress("");
      hideLoading(loadingId);
    }
  };

  if (!canImport) {
    return <p className="text-gray-500">Bạn không có quyền import dữ liệu.</p>;
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto pb-6">
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Chọn file Excel nghiệp vụ (ĐẠI PHÁT 1.3). Hệ thống đọc toàn bộ dữ liệu từ các sheet danh mục, bảng giá,
          <b>Nhật trình (2)</b> và <b>Sổ thu chi</b>; dữ liệu báo cáo được liên kết thành chuyến xe và phiếu thu / chi.
          Dữ liệu sẽ được xem trước, chỉ ghi vào hệ thống khi bạn xác nhận.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label>File Excel</Label>
            <input
              id="excel-file-input"
              type="file"
              accept=".xlsx,.xlsm"
              onChange={onSelectFile}
              className="sr-only"
            />
            <Button asChild type="button" size="lg" className="w-fit cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
              <label htmlFor="excel-file-input">
                <Upload className="h-4 w-4" />
                Chọn file Excel
              </label>
            </Button>
          </div>
          <div>
            <Label>Bảng giá có hiệu lực từ ngày</Label>
            <InputDatePicker
              size="md"
              className="w-44"
              value={effectiveFrom ? parseISO(effectiveFrom) : undefined}
              onChange={(date) => setEffectiveFrom(date ? format(date, DATE_FORMAT.YYYY_MM_DD) : "")}
            />
          </div>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={includeRowsWithoutProduct}
            onChange={(e) => void onToggleUnknownProduct(e.target.checked)}
            className="mt-1"
          />
          <span>
            Import cả các dòng bảng giá <b>không ghi hàng hóa</b> trong file Excel (gán tạm hàng hóa &quot;Chưa xác
            định&quot; để giữ lại đơn giá / cước, bổ sung sau). Bỏ chọn thì các dòng đó bị bỏ qua.
          </span>
        </label>
        {fileName && <p className="mt-2 text-xs text-gray-500">Đã chọn: {fileName}</p>}
        {progress && <p className="mt-2 text-xs text-brand-500">{progress}</p>}
      </div>

      {parsed && (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h4 className="mb-3 font-semibold text-gray-800 dark:text-white/90">Xem trước dữ liệu đọc được</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {ENTITY_LABELS.map((entity) => (
              <div key={entity.key} className="rounded-md bg-gray-50 p-3 dark:bg-white/[0.03]">
                <p className="text-xs text-gray-500">{entity.label}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {(parsed[entity.key] as unknown[]).length}
                </p>
              </div>
            ))}
          </div>

          {parsed.warnings.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-warning-600">
                {parsed.warnings.length} cảnh báo cần lưu ý (dòng bị bỏ qua / trùng lặp):
              </p>
              <div className="max-h-60 overflow-y-auto rounded-md border border-warning-200 bg-warning-50 p-3 text-xs dark:border-warning-500/30 dark:bg-warning-500/10">
                <ul className="list-disc space-y-1 pl-4">
                  {parsed.warnings.map((warning, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button onClick={onImport} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Import vào hệ thống
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h4 className="mb-3 font-semibold text-gray-800 dark:text-white/90">Kết quả import</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {ENTITY_LABELS.map((entity) => {
              const counter = result[entity.key as keyof ImportResult] as { created: number; skipped: number };
              return (
                <div key={entity.key} className="rounded-md bg-gray-50 p-3 dark:bg-white/[0.03]">
                  <p className="text-xs text-gray-500">{entity.label}</p>
                  <p className="text-sm font-semibold text-success-600">+{counter.created} thêm mới</p>
                  <p className="text-xs text-gray-500">{counter.skipped} bỏ qua (đã có)</p>
                </div>
              );
            })}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-error-600">{result.errors.length} dòng lỗi:</p>
              <div className="max-h-60 overflow-y-auto rounded-md border border-error-200 bg-error-50 p-3 text-xs dark:border-error-500/30 dark:bg-error-500/10">
                <ul className="list-disc space-y-1 pl-4">
                  {result.errors.map((error, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
