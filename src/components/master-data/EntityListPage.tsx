"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { EntityImportDialog } from "@/components/common/EntityImportDialog";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { RowAction, RowActionsMenu } from "@/components/common/RowActionsMenu";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { usePermission } from "@/context/PermissionContext";
import { useModal } from "@/hooks/useModal";
import { CrudService } from "@/lib/firestoreCrud";
import { ImportColumn } from "@/lib/excel/genericImport";
import { BaseEntity } from "@/types/common";
import { getErrorMessage } from "@/utils/errorHandler";
import { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, Edit, Eye, Upload } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { DefaultValues, FieldValues, Resolver, UseFormReturn, useForm } from "react-hook-form";

type CreatePayload<T extends BaseEntity> = Omit<T, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">;

export interface EntityImportConfig<T extends BaseEntity> {
  columns: ImportColumn<T>[];
  sheetName: string;
  templateFileName: string;
  /**
   * Validate + build payload cho 1 dòng đã đọc từ file Excel (mục 34.1, 34.3). `rowsSoFar` là các
   * payload đã hợp lệ ở những dòng trước trong cùng file — dùng để tự phát hiện trùng ngay trong file
   * đang import, không chỉ trùng với dữ liệu đã có trong hệ thống.
   */
  validateRow: (
    raw: Partial<Record<keyof T, unknown>>,
    rowsSoFar: CreatePayload<T>[],
    existingData: T[]
  ) => Promise<{ payload?: CreatePayload<T>; errors: string[] }>;
}

export interface EntityListPageProps<T extends BaseEntity, TForm extends FieldValues> {
  resourceKey: string;
  service: CrudService<T>;
  resolver: Resolver<TForm>;
  defaultValues: TForm;
  toFormValues: (item: T) => TForm;
  /** Có thể trả Promise (vd: sinh mã chứng từ tự động qua getNextSequence trước khi lưu). */
  buildCreatePayload: (
    values: TForm
  ) =>
    | Omit<T, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">
    | Promise<Omit<T, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">>;
  buildUpdatePayload: (values: TForm) => Partial<Omit<T, "id" | "createdAt" | "createdBy">>;
  /**
   * Các cột nghiệp vụ của bảng (cột "Chức năng" được thêm tự động).
   * Mảng phải có identity ổn định (module-level const hoặc useMemo) để bảng không bị dựng lại
   * mỗi lần render; và phải tính lại khi dữ liệu tham chiếu trong cell thay đổi.
   */
  columns: ColumnDef<T>[];
  renderForm: (form: UseFormReturn<TForm>, mode: "create" | "update") => ReactNode;
  /** Trả về thông báo lỗi nếu dữ liệu không hợp lệ (vd: trùng mã), null nếu hợp lệ. */
  validate?: (values: TForm, mode: "create" | "update", editingId?: string) => Promise<string | null>;
  entityLabel: string;
  dialogClassName?: string;
  /** Nội dung tùy chọn (vd: thẻ tổng hợp Tổng thu/Tổng chi/Số dư) hiển thị phía trên bảng. */
  renderExtra?: (data: T[]) => ReactNode;
  /**
   * Lọc dữ liệu trước khi hiển thị (vd: bộ lọc khoảng ngày, mục 44.1) — áp dụng cho cả bảng lẫn
   * renderExtra để số tổng hợp khớp đúng dữ liệu đang lọc. Không set = hiển thị nguyên toàn bộ
   * (hành vi cũ, không đổi cho các trang chưa dùng prop này).
   */
  dataFilter?: (data: T[]) => T[];
  /** Cho phép import hàng loạt từ Excel qua file mẫu tự sinh (mục 34) — không set = không hiện nút Import. */
  importConfig?: EntityImportConfig<T>;
  /** Thêm thao tác riêng vào menu "..." của từng dòng (vd "In phiếu", mục 36) — chèn trước Sửa/Ngừng hoạt động. */
  extraRowActions?: (item: T) => RowAction[];
}

export function EntityListPage<T extends BaseEntity, TForm extends FieldValues>({
  resourceKey,
  service,
  resolver,
  defaultValues,
  toFormValues,
  buildCreatePayload,
  buildUpdatePayload,
  importConfig,
  columns,
  renderForm,
  validate,
  entityLabel,
  dialogClassName,
  renderExtra,
  dataFilter,
  extraRowActions,
}: EntityListPageProps<T, TForm>) {
  const [data, setData] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  /** Mở dialog ở chế độ chỉ xem (mọi role có quyền VIEW đều bấm được, kể cả role không có UPDATE —
   * trước đây không có cách nào xem chi tiết 1 dòng nếu không có quyền Sửa). */
  const [viewOnly, setViewOnly] = useState(false);
  const { showLoading, hideLoading } = useLoading();
  const { alert, confirm } = useFeedbackDialog();
  const { can } = usePermission();
  const { user } = useCurrentUser();
  const { isOpen, openModal, closeModal } = useModal();
  const { isOpen: isImportOpen, openModal: openImportModal, closeModal: closeImportModal } = useModal();

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const res = await service.getAll();
      setData(res);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy danh sách thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const form = useForm<TForm>({
    resolver,
    defaultValues: defaultValues as DefaultValues<TForm>,
  });

  const mode: "create" | "update" = editing ? "update" : "create";

  const openCreate = () => {
    setEditing(null);
    setViewOnly(false);
    form.reset(defaultValues);
    openModal();
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setViewOnly(false);
    form.reset(toFormValues(item));
    openModal();
  };

  const openView = (item: T) => {
    setEditing(item);
    setViewOnly(true);
    form.reset(toFormValues(item));
    openModal();
  };

  const onToggleStatus = async (item: T) => {
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const isConfirm = await confirm({
      title: "Xác nhận",
      content:
        nextStatus === "INACTIVE"
          ? `Ngừng hoạt động ${entityLabel.toLowerCase()} này? Dữ liệu không bị xóa, có thể khôi phục lại sau.`
          : `Khôi phục hoạt động cho ${entityLabel.toLowerCase()} này?`,
    });
    if (!isConfirm) return;
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await service.setStatus(item.id, nextStatus, user?.id ?? "");
      await alert({ title: "Thành công", content: "Cập nhật trạng thái thành công" });
      await fetchData();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Cập nhật thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const onSubmit = async (values: TForm) => {
    if (validate) {
      const errorMessage = await validate(values, mode, editing?.id);
      if (errorMessage) {
        await alert({ title: "Cảnh báo", content: errorMessage });
        return;
      }
    }
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      if (mode === "create") {
        await service.create(await buildCreatePayload(values), user?.id ?? "");
        await alert({ title: "Thành công", content: `Thêm ${entityLabel.toLowerCase()} thành công` });
      } else if (editing) {
        await service.update(editing.id, buildUpdatePayload(values), user?.id ?? "");
        await alert({ title: "Thành công", content: `Cập nhật ${entityLabel.toLowerCase()} thành công` });
      }
      closeModal();
      await fetchData();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lưu thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  const tableColumns = useMemo(() => {
    const actionColumn: ColumnDef<T> = {
      id: "actions",
      header: () => <span className="text-xs w-full block text-center">Chức năng</span>,
      cell: ({ row }) => {
        const item = row.original;
        const actions: RowAction[] = [];

        if (can(resourceKey, "VIEW")) {
          actions.push({
            key: "view",
            label: "Xem",
            icon: <Eye className="h-4 w-4 text-gray-500" />,
            onSelect: () => openView(item),
          });
        }

        actions.push(...(extraRowActions ? extraRowActions(item) : []));

        if (can(resourceKey, "UPDATE")) {
          actions.push({
            key: "edit",
            label: "Sửa",
            icon: <Edit className="h-4 w-4 text-gray-500" />,
            onSelect: () => openEdit(item),
          });
        }

        if (can(resourceKey, "DELETE")) {
          actions.push(
            item.status === "ACTIVE"
              ? {
                  key: "deactivate",
                  label: "Ngừng hoạt động",
                  icon: <Ban className="h-4 w-4 text-error-600" />,
                  onSelect: () => onToggleStatus(item),
                  danger: true,
                }
              : {
                  key: "activate",
                  label: "Khôi phục hoạt động",
                  icon: <CheckCircle2 className="h-4 w-4 text-success-600" />,
                  onSelect: () => onToggleStatus(item),
                }
          );
        }

        return <RowActionsMenu ariaLabel={`Chức năng ${entityLabel.toLowerCase()}`} actions={actions} />;
      },
    };
    return [...columns, actionColumn];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, can]);

  const displayData = dataFilter ? dataFilter(data) : data;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {renderExtra && (
        <ErrorBoundary label={`tổng hợp ${entityLabel.toLowerCase()}`}>{renderExtra(displayData)}</ErrorBoundary>
      )}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <DataTable
          className="h-full w-full overflow-y-auto border"
          tHeadClass="z-40"
          data={displayData ?? []}
          columns={tableColumns}
          enablePaging
          enableColumnFilter
          enableGlobalFilter
          enableExport
          exportFileName={entityLabel}
          onChange={setData}
        />
      </div>
      <div className="border-t p-2 flex justify-end gap-2 shrink-0">
        {importConfig && can(resourceKey, "IMPORT") && (
          <Button variant="outline" onClick={openImportModal} className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
        )}
        {can(resourceKey, "CREATE") && (
          <Button variant="default" onClick={openCreate} className="flex items-center gap-2">
            Thêm
          </Button>
        )}
      </div>

      {importConfig && (
        <EntityImportDialog<T, CreatePayload<T>>
          open={isImportOpen}
          onOpenChange={(open) => (open ? openImportModal() : closeImportModal())}
          entityLabel={entityLabel}
          sheetName={importConfig.sheetName}
          templateFileName={importConfig.templateFileName}
          columns={importConfig.columns}
          validateRow={(raw, rowsSoFar) => importConfig.validateRow(raw, rowsSoFar, data)}
          onCreateOne={async (payload) => {
            await service.create(payload, user?.id ?? "");
          }}
          onImported={fetchData}
        />
      )}

      {isOpen && (
        <Dialog open={true} onOpenChange={closeModal}>
          <DialogContent className={dialogClassName ?? "bg-white min-w-[600px] flex flex-col justify-between p-4"}>
            <DialogHeader className="w-full">
              <DialogTitle className="text-md">
                {viewOnly
                  ? `Xem ${entityLabel.toLowerCase()}`
                  : mode === "create"
                    ? `Thêm ${entityLabel.toLowerCase()}`
                    : `Cập nhật ${entityLabel.toLowerCase()}`}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
                {/* Chế độ Xem: khóa toàn bộ input trong form bằng 1 fieldset chung, không phải sửa từng
                    field ở từng trang — display:contents để không đổi layout hiện có. */}
                <fieldset disabled={viewOnly} className="contents">
                  <ErrorBoundary label={`form ${entityLabel.toLowerCase()}`}>{renderForm(form, mode)}</ErrorBoundary>
                </fieldset>
                <div className="flex justify-end mt-4 w-full">
                  {viewOnly ? (
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Đóng
                    </Button>
                  ) : (
                    <Button variant="default" type="submit" className="flex items-center gap-2">
                      Lưu
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
