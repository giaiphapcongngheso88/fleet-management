"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
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
import { BaseEntity } from "@/types/common";
import { getErrorMessage } from "@/utils/errorHandler";
import { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, Edit } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { DefaultValues, FieldValues, Resolver, UseFormReturn, useForm } from "react-hook-form";

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
}

export function EntityListPage<T extends BaseEntity, TForm extends FieldValues>({
  resourceKey,
  service,
  resolver,
  defaultValues,
  toFormValues,
  buildCreatePayload,
  buildUpdatePayload,
  columns,
  renderForm,
  validate,
  entityLabel,
  dialogClassName,
  renderExtra,
  dataFilter,
}: EntityListPageProps<T, TForm>) {
  const [data, setData] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const { showLoading, hideLoading } = useLoading();
  const { alert, confirm } = useFeedbackDialog();
  const { can } = usePermission();
  const { user } = useCurrentUser();
  const { isOpen, openModal, closeModal } = useModal();

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
    form.reset(defaultValues);
    openModal();
  };

  const openEdit = (item: T) => {
    setEditing(item);
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
          onChange={setData}
        />
      </div>
      <div className="border-t p-2 flex justify-end shrink-0">
        {can(resourceKey, "CREATE") && (
          <Button variant="default" onClick={openCreate} className="flex items-center gap-2">
            Thêm
          </Button>
        )}
      </div>

      {isOpen && (
        <Dialog open={true} onOpenChange={closeModal}>
          <DialogContent className={dialogClassName ?? "bg-white min-w-[600px] flex flex-col justify-between p-4"}>
            <DialogHeader className="w-full">
              <DialogTitle className="text-md">
                {mode === "create" ? `Thêm ${entityLabel.toLowerCase()}` : `Cập nhật ${entityLabel.toLowerCase()}`}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
                <ErrorBoundary label={`form ${entityLabel.toLowerCase()}`}>{renderForm(form, mode)}</ErrorBoundary>
                <div className="flex justify-end mt-4 w-full">
                  <Button variant="default" type="submit" className="flex items-center gap-2">
                    Lưu
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
