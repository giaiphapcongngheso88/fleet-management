import VendorPage from "@/components/master-data/vendor/VendorPage";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="shrink-0 text-lg font-semibold text-gray-800 dark:text-white/90 mb-2 mt-2">
        Đơn vị vận tải
      </h3>
      <VendorPage />
    </div>
  );
}
