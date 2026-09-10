"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { SelectFormField, TextFormField } from "@/components/master-data/FormFields";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { adminCreateUser } from "@/lib/auth";
import { getErrorMessage } from "@/utils/errorHandler";
import { ALL_ROLES, ROLE_LABEL } from "@/utils/permissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  fullName: z.string().min(1, "Vui lòng nhập họ tên"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "QUAN_LY", "DIEU_HANH", "KE_TOAN", "STAFF"]),
});

type FormValues = z.infer<typeof schema>;

const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export default function CreateUserModal({ onClose, fetchData }: { onClose: () => void; fetchData: () => Promise<void> }) {
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", fullName: "", phone: "", role: "STAFF" },
  });

  const onSubmit = async (values: FormValues) => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await adminCreateUser({ ...values, createdBy: user?.id ?? "" });
      await alert({ title: "Thành công", content: "Tạo người dùng thành công" });
      await fetchData();
      onClose();
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Tạo người dùng thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white min-w-[600px] flex flex-col justify-between p-4">
        <DialogHeader className="w-full">
          <DialogTitle className="text-md">Thêm người dùng</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextFormField control={form.control} name="fullName" label="Họ tên" required />
              <TextFormField control={form.control} name="phone" label="Điện thoại" />
              <TextFormField control={form.control} name="email" label="Email" required />
              <TextFormField control={form.control} name="password" label="Mật khẩu" type="password" required />
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
