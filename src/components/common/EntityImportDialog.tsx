"use client";

import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBlob, generateImportTemplate, ImportColumn, parseImportFile } from "@/lib/excel/genericImport";
import { getErrorMessage } from "@/utils/errorHandler";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

export interface ImportRowPreview<TPayload> {
  rowNumber: number;
  /** Vài cột đầu để hiển thị preview cho người dùng nhận diện dòng nào là dòng nào. */
  preview: Record<string, string>;
  payload?: TPayload;
  errors: string[];
}

export interface EntityImportDialogProps<T, TPayload> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel: string;
  sheetName: string;
  templateFileName: string;
  columns: ImportColumn<T>[];
  /**
   * Validate + build payload cho 1 dòng đã đọc từ Excel (mục 34.1: Validate). `rowsSoFar` là các
   * payload đã hợp lệ ở những dòng trước trong cùng file — dùng để tự phát hiện trùng trong chính
   * file đang import (không chỉ trùng với dữ liệu đã có trong hệ thống).
   */
  validateRow: (
    raw: Partial<Record<keyof T, unknown>>,
    rowsSoFar: TPayload[]
  ) => Promise<{ payload?: TPayload; errors: string[] }>;
  onCreateOne: (payload: TPayload) => Promise<void>;
  onImported: () => Promise<void> | void;
}

type Stage = "idle" | "validating" | "preview" | "importing" | "done";

export function EntityImportDialog<T, TPayload>({
  open,
  onOpenChange,
  entityLabel,
  sheetName,
  templateFileName,
  columns,
  validateRow,
  onCreateOne,
  onImported,
}: EntityImportDialogProps<T, TPayload>) {
  const { alert } = useFeedbackDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [rows, setRows] = useState<ImportRowPreview<TPayload>[]>([]);
  const [doneSummary, setDoneSummary] = useState<{ success: number; failed: number } | null>(null);

  const reset = () => {
    setStage("idle");
    setRows([]);
    setDoneSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDownloadTemplate = async () => {
    const blob = await generateImportTemplate(sheetName, columns);
    downloadBlob(blob, templateFileName);
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("validating");
    try {
      const parsed = await parseImportFile(file, columns);
      if (parsed.formatError) {
        await alert({ title: "Sai định dạng file", content: parsed.formatError });
        reset();
        return;
      }
      if (parsed.rows.length === 0) {
        await alert({ title: "Cảnh báo", content: "File không có dòng dữ liệu nào." });
        reset();
        return;
      }

      const preview: ImportRowPreview<TPayload>[] = [];
      const validPayloads: TPayload[] = [];
      for (const row of parsed.rows) {
        const rowText: Record<string, string> = {};
        for (const col of columns) rowText[col.header] = String(row.data[col.key] ?? "");

        if (row.errors.length > 0) {
          preview.push({ rowNumber: row.rowNumber, preview: rowText, errors: row.errors });
          continue;
        }
        try {
          const result = await validateRow(row.data, validPayloads);
          if (result.payload && result.errors.length === 0) validPayloads.push(result.payload);
          preview.push({ rowNumber: row.rowNumber, preview: rowText, payload: result.payload, errors: result.errors });
        } catch (err: unknown) {
          preview.push({ rowNumber: row.rowNumber, preview: rowText, errors: [getErrorMessage(err)] });
        }
      }
      setRows(preview);
      setStage("preview");
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Đọc file thất bại: " + getErrorMessage(err) });
      reset();
    }
  };

  const validRows = rows.filter((r) => r.errors.length === 0 && r.payload);

  const onConfirmImport = async () => {
    setStage("importing");
    let success = 0;
    let failed = 0;
    for (const row of validRows) {
      try {
        await onCreateOne(row.payload as TPayload);
        success++;
      } catch {
        failed++;
      }
    }
    setDoneSummary({ success, failed });
    setStage("done");
    await onImported();
  };

  const onClose = () => {
    reset();
    onOpenChange(false);
  };

  const isPreviewLike = stage === "preview" || stage === "validating" || stage === "importing";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // DialogContent gốc có sẵn max-w-lg (512px) — max-width khác nhóm với width trong
          // tailwind-merge nên không tự loại bỏ nhau, phải tự ghi đè max-w-* ở đây, nếu không
          // max-w-lg luôn thắng và hộp thoại không bao giờ rộng hơn 512px dù đặt w-[...] thế nào.
          "bg-white flex flex-col p-4 dark:bg-gray-900",
          isPreviewLike ? "min-w-[320px] w-[96vw] max-w-350 h-[88vh]" : "min-w-[320px] w-[90vw] max-w-150 max-h-[85vh]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-md">Import {entityLabel.toLowerCase()} từ Excel</DialogTitle>
        </DialogHeader>

        {stage === "idle" && (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-gray-500">
              Tải file mẫu, điền dữ liệu {entityLabel.toLowerCase()} theo đúng cột có sẵn (cột có dấu * là bắt buộc), rồi tải file đó
              lên lại để import.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void onDownloadTemplate()} className="flex items-center gap-2">
                <Download className="h-4 w-4" /> Tải file mẫu
              </Button>
              <Button type="button" variant="default" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Chọn file để import
              </Button>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void onFileSelected(e)} />
            </div>
          </div>
        )}

        {stage === "validating" && <p className="text-sm text-gray-500 py-4">Đang đọc và kiểm tra dữ liệu...</p>}

        {stage === "preview" && (
          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
            <p className="text-sm">
              <span className="text-success-600 font-medium">{validRows.length} dòng hợp lệ</span>
              {rows.length - validRows.length > 0 && (
                <span className="text-error-500 font-medium"> — {rows.length - validRows.length} dòng lỗi (sẽ bỏ qua)</span>
              )}
            </p>
            <div className="flex-1 min-h-0 overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left p-2 font-medium">Dòng</th>
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left p-2 font-medium min-w-55">
                      Trạng thái
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} className="text-left p-2 font-medium whitespace-nowrap">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowNumber} className="border-t">
                      <td className="p-2 text-gray-400">{row.rowNumber}</td>
                      <td className="sticky left-0 bg-white dark:bg-gray-900 p-2 min-w-55">
                        {row.errors.length === 0 ? (
                          <span className="flex items-center gap-1 text-success-600">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Hợp lệ
                          </span>
                        ) : (
                          <span className="flex items-start gap-1 text-error-500">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="whitespace-normal">{row.errors.join("; ")}</span>
                          </span>
                        )}
                      </td>
                      {columns.map((c) => (
                        <td key={c.key} className="p-2 whitespace-nowrap max-w-50 truncate">
                          {row.preview[c.header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stage === "importing" && <p className="text-sm text-gray-500 py-4">Đang import dữ liệu...</p>}

        {stage === "done" && doneSummary && (
          <div className="flex flex-col gap-2 py-4">
            <p className="text-success-600 font-medium">Đã import thành công {doneSummary.success} dòng.</p>
            {doneSummary.failed > 0 && <p className="text-error-500">{doneSummary.failed} dòng thất bại khi lưu, vui lòng thử lại.</p>}
          </div>
        )}

        <DialogFooter>
          {stage === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Chọn file khác
              </Button>
              <Button type="button" variant="default" disabled={validRows.length === 0} onClick={() => void onConfirmImport()}>
                Xác nhận import {validRows.length} dòng
              </Button>
            </>
          )}
          {(stage === "idle" || stage === "done") && (
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
