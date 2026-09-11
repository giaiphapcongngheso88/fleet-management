import PayablePage from "@/components/finance/PayablePage";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white p-4 overflow-y-auto dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="shrink-0 text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Công nợ đơn vị vận tải</h3>
      <PayablePage />
    </div>
  );
}
