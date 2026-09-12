import DebtSummaryPage from "@/components/finance/DebtSummaryPage";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white p-4 overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="shrink-0 text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Tổng hợp công nợ</h3>
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <DebtSummaryPage />
      </div>
    </div>
  );
}
