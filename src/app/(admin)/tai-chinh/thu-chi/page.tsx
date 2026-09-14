import FinanceTransactionPage from "@/components/finance/FinanceTransactionPage";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-hidden print:overflow-visible print:h-auto print:border-0 dark:border-gray-800 dark:bg-white/[0.03]">
      <FinanceTransactionPage title="Thu - Chi" />
    </div>
  );
}
