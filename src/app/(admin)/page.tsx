"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { DateRange, DateRangeFilter } from "@/components/common/DateRangeFilter";
import useLoading from "@/components/loading";
import { MonthlyTrendChart, TopBarChart } from "@/components/reports/charts";
import { KpiCard, KpiCardData } from "@/components/reports/KpiCard";
import { financeTransactionService } from "@/services/finance";
import { customerService, driverService, locationService, vehicleService } from "@/services/master-data";
import {
  computeMonthlyTrend,
  computeOverallSummary,
  filterTransactionsInRange,
  filterTripsInRange,
  groupTrips,
} from "@/services/reports";
import { tripService } from "@/services/trip";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Customer, Driver, Location, Vehicle } from "@/types/master-data";
import { FinanceTransaction } from "@/types/finance";
import { Trip } from "@/types/trip";
import { getCurrentMonthRange } from "@/utils/dateRange";
import { getErrorMessage } from "@/utils/errorHandler";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  HandCoins,
  Landmark,
  LineChart,
  PiggyBank,
  Receipt,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();

  const [dateRange, setDateRange] = useState<DateRange>(getCurrentMonthRange());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");
  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const [tripsRes, transactionsRes] = await Promise.all([tripService.getAll(), financeTransactionService.getAll()]);
      setTrips(tripsRes);
      setTransactions(transactionsRes);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy dữ liệu tổng quan thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const tripsInRange = useMemo(() => filterTripsInRange(trips, dateRange.from, dateRange.to), [trips, dateRange]);
  const transactionsInRange = useMemo(
    () => filterTransactionsInRange(transactions, dateRange.from, dateRange.to),
    [transactions, dateRange]
  );

  const summary = useMemo(
    () => computeOverallSummary({ tripsInRange, transactionsInRange, allTrips: trips, allTransactions: transactions }),
    [tripsInRange, transactionsInRange, trips, transactions]
  );

  const refs = useMemo(() => ({ customers, vehicles, drivers, locations }), [customers, vehicles, drivers, locations]);
  const monthlyTrend = useMemo(() => computeMonthlyTrend(trips, 12), [trips]);
  const topCustomers = useMemo(
    () => groupTrips(tripsInRange, "customer", refs).slice(0, 8).map((r) => ({ label: r.label, value: r.revenue })),
    [tripsInRange, refs]
  );
  const topVehicles = useMemo(
    () => groupTrips(tripsInRange, "vehicle", refs).slice(0, 8).map((r) => ({ label: r.label, value: r.revenue })),
    [tripsInRange, refs]
  );

  const kpiCards: KpiCardData[] = [
    { label: "Số chuyến", value: summary.tripCount, icon: Truck },
    { label: "Doanh thu", value: summary.revenue, icon: TrendingUp },
    { label: "Chi phí", value: summary.cost, icon: Receipt },
    { label: "Lợi nhuận", value: summary.profit, icon: PiggyBank, highlight: summary.profit < 0 ? "error" : "success" },
    { label: "Phải thu", value: summary.totalReceivable, icon: HandCoins },
    { label: "Phải trả", value: summary.totalPayable, icon: Landmark },
    { label: "Đã thu", value: summary.totalReceipt, icon: ArrowDownCircle },
    { label: "Đã chi", value: summary.totalPayment, icon: ArrowUpCircle },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-4 overflow-y-auto pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Tổng quan</h1>
        <div className="flex items-center gap-2 shrink-0">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Link href="/bao-cao" className="text-sm text-brand-500 hover:underline whitespace-nowrap">
            Xem báo cáo chi tiết →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
          <LineChart className="h-4 w-4 text-brand-500" />
          Doanh thu / Chi phí / Lợi nhuận theo tháng (12 tháng gần nhất)
        </p>
        <MonthlyTrendChart data={monthlyTrend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
            <Users className="h-4 w-4 text-brand-500" />
            Doanh thu theo khách hàng (top 8, trong kỳ)
          </p>
          {topCustomers.length > 0 ? <TopBarChart data={topCustomers} /> : <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
            <Truck className="h-4 w-4 text-brand-500" />
            Doanh thu theo xe (top 8, trong kỳ)
          </p>
          {topVehicles.length > 0 ? <TopBarChart data={topVehicles} /> : <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>}
        </div>
      </div>
    </div>
  );
}
