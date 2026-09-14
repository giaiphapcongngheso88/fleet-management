import ReceivablePage from "@/components/finance/ReceivablePage";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white p-4 overflow-y-auto print:overflow-visible print:h-auto print:border-0 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="shrink-0 text-lg font-semibold text-gray-800 dark:text-white/90 mb-4 print:hidden">Công nợ khách hàng</h3>
      <ReceivablePage />
    </div>
  );
}
