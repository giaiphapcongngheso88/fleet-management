"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { getSequenceSettings, saveSequenceSetting } from "@/services/sequenceSettings";
import { SequenceKind, SequenceSetting } from "@/types/sequence-settings";
import { getErrorMessage } from "@/utils/errorHandler";

const labels: Record<SequenceKind, string> = { trip: "Chuyến xe", receipt: "Phiếu thu", payment: "Phiếu chi", quote: "Báo giá" };

export default function SequenceSettingsPage() {
  const [rows, setRows] = useState<SequenceSetting[]>([]);
  const { user } = useCurrentUser();
  const { alert } = useFeedbackDialog();
  useEffect(() => {
    void getSequenceSettings()
      .then(setRows)
      .catch(async (error: unknown) => {
        await alert({ title: "Lỗi", content: "Không tải được cấu hình mã: " + getErrorMessage(error) });
      });
  }, [alert]);
  const save = async (row: SequenceSetting) => {
    try {
      await saveSequenceSetting(row, user?.id ?? "");
      await alert({ title: "Thành công", content: "Đã lưu cấu hình mã" });
    } catch (error: unknown) {
      await alert({ title: "Lỗi", content: "Lưu cấu hình mã thất bại: " + getErrorMessage(error) });
    }
  };
  return <div className="space-y-3">
    {rows.map((row) => <div key={row.key} className="grid grid-cols-3 items-end gap-3 max-w-2xl">
      <label className="text-sm font-medium">{labels[row.key]}</label>
      <Input value={row.prefix} onChange={(e) => setRows((all) => all.map((x) => x.key === row.key ? { ...x, prefix: e.target.value } : x))} />
      <div className="flex gap-2"><Input type="number" value={row.nextNumber} onChange={(e) => setRows((all) => all.map((x) => x.key === row.key ? { ...x, nextNumber: Number(e.target.value) } : x))} /><Button type="button" onClick={() => void save(row)}>Lưu</Button></div>
    </div>)}
  </div>;
}
