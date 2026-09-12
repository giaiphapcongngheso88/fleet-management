"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import useLoading from "@/components/loading";
import { ELoadingMessages } from "@/app/lib/enums";
import { debtReconciliationService, getDebtReconciliations } from "@/services/finance";
import { DebtReconciliation, DebtReconciliationObjectType } from "@/types/debt-reconciliation";
import { getErrorMessage } from "@/utils/errorHandler";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { LedgerResult } from "@/services/finance";

const today = () => new Date().toISOString().slice(0, 10);
const currencyFormatter = new Intl.NumberFormat("vi-VN");

interface DebtReconciliationDialogProps {
  objectType: DebtReconciliationObjectType;
  objectId: string;
  partnerName: string;
  ledger: LedgerResult;
}

export function DebtReconciliationDialog({ objectType, objectId, partnerName, ledger }: DebtReconciliationDialogProps) {
  const { user } = useCurrentUser();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [confirmedAmount, setConfirmedAmount] = useState(String(ledger.balance));
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<DebtReconciliation[]>([]);

  useEffect(() => {
    if (!open) return;
    setDate(today());
    setConfirmedAmount(String(ledger.balance));
    setNote("");
    void getDebtReconciliations(objectType, objectId).then(setHistory).catch((error: unknown) => {
      void alert({ title: "Lỗi", content: "Lấy lịch sử đối chiếu thất bại: " + getErrorMessage(error) });
    });
  }, [alert, ledger.balance, objectId, objectType, open]);

  const onSubmit = async () => {
    const amount = Number(confirmedAmount);
    if (!date || !Number.isFinite(amount) || amount < 0) {
      await alert({ title: "Cảnh báo", content: "Vui lòng nhập ngày và số tiền xác nhận hợp lệ." });
      return;
    }
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await debtReconciliationService.create(
        {
          objectType,
          objectId,
          reconciliationDate: date,
          asOfDate: date,
          calculatedAmount: ledger.balance,
          confirmedAmount: amount,
          note: note.trim() || undefined,
          status: "ACTIVE",
        },
        user?.id ?? ""
      );
      const nextHistory = await getDebtReconciliations(objectType, objectId);
      setHistory(nextHistory);
      await alert({ title: "Thành công", content: "Đã lưu biên bản đối chiếu công nợ." });
      setOpen(false);
    } catch (error: unknown) {
      await alert({ title: "Lỗi", content: "Đối chiếu công nợ thất bại: " + getErrorMessage(error) });
    } finally {
      hideLoading(loadingId);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Đối chiếu công nợ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-xl p-4">
          <DialogHeader>
            <DialogTitle>Đối chiếu công nợ - {partnerName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Ngày đối chiếu</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div>
              <Label>Công nợ hệ thống</Label>
              <p className="h-9 flex items-center font-semibold">{currencyFormatter.format(ledger.balance)}</p>
            </div>
            <div>
              <Label>Số tiền đối tác xác nhận</Label>
              <Input
                type="number"
                min="0"
                value={confirmedAmount}
                onChange={(event) => setConfirmedAmount(event.target.value)}
              />
            </div>
            <div>
              <Label>Chênh lệch</Label>
              <p className="h-9 flex items-center font-semibold">
                {currencyFormatter.format(Number(confirmedAmount || 0) - ledger.balance)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label>Ghi chú</Label>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi nhận nội dung đối chiếu..." />
            </div>
          </div>
          {history.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-2">Lịch sử đối chiếu</p>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                {history.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 border-b pb-1">
                    <span>{format(new Date(item.reconciliationDate), "dd/MM/yyyy")}</span>
                    <span>{currencyFormatter.format(item.confirmedAmount)}</span>
                    <span className="truncate">{item.note || "Không có ghi chú"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="button" onClick={() => void onSubmit()}>Lưu đối chiếu</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
