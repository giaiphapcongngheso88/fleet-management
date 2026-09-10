"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { SelectFormField, TextFormField } from "@/components/master-data/FormFields";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { updateUserProfile } from "@/services/user";
import { AppUser } from "@/types/user";
import { getErrorMessage } from "@/utils/errorHandler";
import { ALL_ROLES, ROLE_LABEL } from "@/utils/permissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ tên"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "QUAN_LY", "DIEU_HANH", "KE_TOAN", "STAFF"]),
});

type FormValues = z.infer<typeof schema>;

const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export default function EditUserModal({
  target,
  onClose,
  fetchData,
}: {
  target: AppUser;
  onClose: () => void;
  fetchData: () => Promise<void>;
}) {
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: target.fullName, phone: target.phone ?? "", role: target.role },
  });

  const onSubmit = async (values: FormValues) => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await updateUserProfile(target.id, values, user?.id ?? "");
      await alert({ title: "Thành công", content: "Cập nhật người dùng thành công" });
      await fetchData();
      onClose();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Cập nhật thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white min-w-[600px] flex flex-col justify-between p-4">
        <DialogHeader className="w-full">
          <DialogTitle className="text-md">Cập nhật người dùng</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextFormField control={form.control} name="fullName" label="Họ tên" required />
              <TextFormField control={form.control} name="phone" label="Điện thoại" />
              <SelectFormField control={form.control} name="role" label="Vai trò" options={roleOptions} required />
            </div>
            <div className="flex justify-end mt-4 w-full">
              <Button variant="default" type="submit">
                Lưu
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
