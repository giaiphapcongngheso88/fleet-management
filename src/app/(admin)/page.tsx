export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90 mb-2">Tổng quan</h1>
      <p className="text-gray-500 dark:text-gray-400">
        Dashboard doanh thu / chi phí / lợi nhuận / công nợ sẽ được xây dựng ở phase sau, sau khi có dữ liệu
        chuyến xe và tài chính.
      </p>
    </div>
  );
}
