"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useLoading from "@/components/loading";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { changeOwnPassword } from "@/lib/auth";
import { ROLE_LABEL } from "@/utils/permissions";
import { getErrorMessage } from "@/utils/errorHandler";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  newPassword: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordForm() {
  const { user } = useCurrentUser();
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { newPassword: "" } });

  const onSubmit = async (values: FormValues) => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      await changeOwnPassword(values.newPassword);
      await alert({ title: "Thành công", content: "Đổi mật khẩu thành công" });
      form.reset({ newPassword: "" });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Đổi mật khẩu thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  return (
    <div className="max-w-md flex flex-col gap-4">
      <div>
        <p className="text-sm text-gray-500">Họ tên</p>
        <p className="font-medium">{user?.fullName}</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">Email</p>
        <p className="font-medium">{user?.email}</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">Vai trò</p>
        <p className="font-medium">{user?.role ? ROLE_LABEL[user.role] : ""}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 mt-4">
          <Label>Đổi mật khẩu mới</Label>
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button type="submit">Cập nhật mật khẩu</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
