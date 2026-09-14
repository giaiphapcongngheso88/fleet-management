"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { TextFormField } from "@/components/master-data/FormFields";
import useLoading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useCurrentUser } from "@/context/CurrentUserContext";
import { CompanyInfo, DEFAULT_COMPANY_INFO, getCompanyInfo, saveCompanyInfo } from "@/services/companyInfo";
import { getErrorMessage } from "@/utils/errorHandler";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

/** Firestore giới hạn 1MB/document; 3 ảnh (logo+con dấu+chữ ký) dùng chung 1 document nên mỗi ảnh
 * giới hạn ~250KB gốc (base64 phình thêm ~33%) để chắc chắn không vượt giới hạn. */
const MAX_IMAGE_BYTES = 250 * 1024;

const schema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên công ty"),
  address: z.string().min(1, "Vui lòng nhập địa chỉ"),
  phone: z.string().min(1, "Vui lòng nhập số điện thoại"),
  taxCode: z.string().min(1, "Vui lòng nhập mã số thuế"),
  email: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankName: z.string().optional(),
  directorName: z.string().optional(),
  vatRatePercent: z.number().min(0, "Tỉ lệ VAT không được âm").max(100, "Tỉ lệ VAT không được quá 100%"),
});

type FormValues = z.infer<typeof schema>;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ImageUploadField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const { alert } = useFeedbackDialog();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      await alert({ title: "Ảnh quá lớn", content: `Vui lòng chọn ảnh dưới ${Math.round(MAX_IMAGE_BYTES / 1024)}KB.` });
      return;
    }
    onChange(await readFileAsDataUrl(file));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <p className="text-xs text-gray-400">{hint}</p>
      <div className="flex items-center gap-3">
        {value ? (
          <Image src={value} alt={label} width={64} height={64} unoptimized className="h-16 w-16 object-contain border rounded bg-white" />
        ) : (
          <div className="h-16 w-16 border rounded flex items-center justify-center text-[10px] text-center text-gray-400">Dùng mặc định</div>
        )}
        <div className="flex flex-col gap-1 items-start">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="text-xs w-40"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              Xóa ảnh (dùng mặc định)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Trang cấu hình thông tin công ty (tên/địa chỉ/MST/ĐT/logo/con dấu/chữ ký) dùng làm letterhead + khối
 * chữ ký khi xuất Excel Bảng lương/Báo giá/Danh thu xe/Công nợ theo đúng mẫu chứng từ (mục 35) — trước
 * đây hard-code trong `styledWorkbook.ts`, giờ Admin tự chỉnh không cần sửa code.
 */
export default function CompanyInfoPage() {
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();
  const { user } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [sealDataUrl, setSealDataUrl] = useState<string | undefined>();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_COMPANY_INFO,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const info = await getCompanyInfo();
        form.reset({
          name: info.name,
          address: info.address,
          phone: info.phone,
          taxCode: info.taxCode,
          email: info.email ?? "",
          bankAccountNo: info.bankAccountNo ?? "",
          bankName: info.bankName ?? "",
          directorName: info.directorName ?? "",
          vatRatePercent: info.vatRatePercent ?? DEFAULT_COMPANY_INFO.vatRatePercent ?? 0,
        });
        setLogoDataUrl(info.logoDataUrl);
        setSealDataUrl(info.sealDataUrl);
        setSignatureDataUrl(info.signatureDataUrl);
      } catch (err: unknown) {
        await alert({ title: "Lỗi", content: "Tải thông tin công ty thất bại: " + getErrorMessage(err) });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: FormValues) => {
    const loadingId = showLoading(ELoadingMessages.PROCESSING_DATA);
    try {
      const info: CompanyInfo = { ...values, logoDataUrl, sealDataUrl, signatureDataUrl };
      await saveCompanyInfo(info, user?.id ?? "");
      await alert({ title: "Thành công", content: "Đã lưu thông tin công ty. Các lần xuất Excel tiếp theo sẽ dùng thông tin mới." });
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lưu thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Đang tải...</p>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-2xl">
        <p className="text-sm text-gray-500">
          Thông tin bên dưới dùng làm letterhead (tên công ty, địa chỉ, MST, ĐT, logo) và khối chữ ký (con dấu, chữ ký) khi xuất Excel
          Bảng lương tài xế / Báo giá / Danh thu xe / Công nợ theo đúng mẫu chứng từ. Bỏ trống ảnh nào thì lần xuất sẽ dùng ảnh mặc định.
        </p>

        <TextFormField control={form.control} name="name" label="Tên công ty" required />
        <TextFormField control={form.control} name="address" label="Địa chỉ" required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextFormField control={form.control} name="taxCode" label="Mã số thuế" required />
          <TextFormField control={form.control} name="phone" label="Số điện thoại" required />
        </div>
        <TextFormField control={form.control} name="email" label="Email" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextFormField control={form.control} name="bankAccountNo" label="Số tài khoản ngân hàng" />
          <TextFormField control={form.control} name="bankName" label="Ngân hàng (có thể ghi cả chi nhánh)" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextFormField control={form.control} name="directorName" label="Tên giám đốc (in dưới con dấu/chữ ký)" />
          <TextFormField control={form.control} name="vatRatePercent" type="number" label="Tỉ lệ VAT (%) — áp dụng cho công nợ khách hàng" required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          <ImageUploadField label="Logo công ty" hint="Hiện góc trên trái letterhead." value={logoDataUrl} onChange={setLogoDataUrl} />
          <ImageUploadField label="Con dấu" hint="Hiện dưới cột 'Giám đốc' ở khối chữ ký." value={sealDataUrl} onChange={setSealDataUrl} />
          <ImageUploadField label="Chữ ký giám đốc" hint="Hiện dưới cột 'Giám đốc' ở khối chữ ký." value={signatureDataUrl} onChange={setSignatureDataUrl} />
        </div>

        <div className="flex justify-end mt-2">
          <Button type="submit" variant="default">
            Lưu thông tin công ty
          </Button>
        </div>
      </form>
    </Form>
  );
}
