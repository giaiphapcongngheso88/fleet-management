import { CompanyInfo } from "@/services/companyInfo";

/**
 * Tiêu đề công ty dùng chung cho mọi bản in (báo giá, bảng lương, phiếu thu/chi, công nợ...) — đúng
 * bố cục/màu sắc letterhead của file Excel gốc (`styledWorkbook.ts` dùng cho xuất Excel): logo trái,
 * khối thông tin công ty căn giữa (tên đỏ đậm, địa chỉ đen nghiêng, MST/ĐT/Email/Số TK đỏ), tiêu đề
 * chứng từ đỏ đậm bên dưới. `company` lấy từ `useCompanyInfo()` ở trang cha (không tự fetch ở đây) để
 * chắc chắn có dữ liệu trước khi người dùng bấm in.
 */
export function PrintHeader({ title, company }: { title: string; company: CompanyInfo }) {
  const logoSrc = company.logoDataUrl || "/branding/logo.png";
  return (
    <div className="mb-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="Logo công ty" className="h-16 w-16 object-contain shrink-0" />
        <div className="flex-1 text-center text-sm leading-tight">
          <p className="font-bold uppercase text-red-600">{company.name}</p>
          <p className="italic">Địa chỉ: {company.address}</p>
          <p>
            Mã số thuế: <span className="font-bold text-red-600">{company.taxCode}</span>
          </p>
          <p>
            Điện thoại: <span className="text-red-600">{company.phone}</span>
            {company.email && (
              <>
                {" "}
                &nbsp;&nbsp;Email: <span className="text-red-600">{company.email}</span>
              </>
            )}
          </p>
          {(company.bankAccountNo || company.bankName) && (
            <p>
              Số tài khoản: <span className="font-bold text-red-600">{company.bankAccountNo}</span>
              {company.bankName && (
                <>
                  {" "}
                  tại <span className="font-bold text-red-600">{company.bankName}</span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="h-16 w-16 shrink-0" aria-hidden />
      </div>
      <h1 className="text-xl font-bold uppercase text-center text-red-600 mt-3">{title}</h1>
    </div>
  );
}

/**
 * Khối xác nhận cuối bản in — đúng bố cục 2 cột duy nhất mà file Excel gốc dùng (xem
 * `addConfirmationFooter` trong `styledWorkbook.ts`), KHÔNG phải khối 3 cột "Người lập / Kế toán
 * trưởng / Giám đốc": trái = xác nhận của đối tượng chứng từ (`partyLabel`), phải = xác nhận của công
 * ty (tên công ty đỏ đậm + con dấu/chữ ký + tên giám đốc đỏ đậm).
 */
export function PrintSignatureBlock({ partyLabel, company }: { partyLabel: string; company: CompanyInfo }) {
  const sealSrc = company.sealDataUrl || "/branding/seal.png";
  const signatureSrc = company.signatureDataUrl || "/branding/signature.jpg";
  return (
    <div className="grid grid-cols-2 gap-4 mt-10 text-center text-sm">
      <div>
        <p className="font-semibold uppercase">{partyLabel}</p>
        <p className="text-xs italic text-gray-500 mt-1">(Ký và ghi rõ họ tên)</p>
      </div>
      <div>
        <p className="font-semibold uppercase">Xác nhận của công ty</p>
        <p className="font-bold text-red-600 mt-1">{company.name}</p>
        <div className="relative h-24 flex items-center justify-center my-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sealSrc} alt="Con dấu" className="absolute h-20 w-20 object-contain opacity-90" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signatureSrc} alt="Chữ ký" className="absolute h-10 w-10 object-contain" />
        </div>
        {company.directorName && <p className="font-bold text-red-600">{company.directorName.toLocaleUpperCase("vi-VN")}</p>}
      </div>
    </div>
  );
}
