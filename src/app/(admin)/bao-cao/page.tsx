"use client";

import { ELoadingMessages } from "@/app/lib/enums";
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { cn } from "@/app/lib/utils";
import { DateRange, DateRangeFilter } from "@/components/common/DateRangeFilter";
import useLoading from "@/components/loading";
import { DonutChart, MonthlyTrendChart, TopBarChart } from "@/components/reports/charts";
import { KpiCard, KpiCardData } from "@/components/reports/KpiCard";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Select } from "@/components/ui/select/select";
import { useReferenceData } from "@/hooks/useReferenceData";
import { financeTransactionService } from "@/services/finance";
import {
  costTypeService,
  customerService,
  driverService,
  locationService,
  productService,
  vehicleService,
} from "@/services/master-data";
import {
  CostTypeRow,
  MonthlyTrendRow,
  ProductRevenueRow,
  TRIP_DIMENSION_LABEL,
  TripDimension,
  TripGroupRow,
  computeMonthlyTrend,
  computeOverallSummary,
  filterTransactionsInRange,
  filterTripsInRange,
  getPreviousRange,
  groupCostByType,
  groupRevenueByProduct,
  groupTrips,
  percentChange,
} from "@/services/reports";
import { tripService } from "@/services/trip";
import { CostType } from "@/types/cost-type";
import { FinanceTransaction } from "@/types/finance";
import { Customer, Driver, Location, Product, Vehicle } from "@/types/master-data";
import { Trip } from "@/types/trip";
import { exportVehicleStatementToExcel } from "@/lib/excel/vehicleStatementExport";
import { getCurrentMonthRange } from "@/utils/dateRange";
import { getErrorMessage } from "@/utils/errorHandler";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  ArrowUpCircle,
  Download,
  HandCoins,
  Landmark,
  LayoutGrid,
  LineChart,
  LucideIcon,
  PiggyBank,
  Receipt,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

type ReportTab = "tong-hop" | "doanh-thu" | "chi-phi" | "loi-nhuan";

const TAB_LABEL: Record<ReportTab, string> = {
  "tong-hop": "Tổng hợp",
  "doanh-thu": "Doanh thu",
  "chi-phi": "Chi phí",
  "loi-nhuan": "Lợi nhuận",
};

const TAB_ICON: Record<ReportTab, LucideIcon> = {
  "tong-hop": LayoutGrid,
  "doanh-thu": TrendingUp,
  "chi-phi": Receipt,
  "loi-nhuan": PiggyBank,
};

const REVENUE_DIMENSIONS: TripDimension[] = ["day", "month", "customer", "vehicle", "driver", "trip", "route"];
const COST_DIMENSIONS: TripDimension[] = ["day", "month", "vehicle", "driver", "trip"];
const PROFIT_DIMENSIONS: TripDimension[] = ["day", "month", "customer", "vehicle", "trip"];
/** Chỉ 2 chiều này mới bấm vào xem được chi tiết từng chuyến (giống sổ chi tiết theo xe trong Excel gốc). */
const DRILLABLE_DIMENSIONS: TripDimension[] = ["vehicle", "driver"];

const dimensionOptions = (dims: TripDimension[], extra?: { value: string; label: string }) => [
  ...dims.map((d) => ({ value: d as string, label: TRIP_DIMENSION_LABEL[d] })),
  ...(extra ? [extra] : []),
];

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const pct = percentChange(current, previous);
  if (pct === null) return null;
  const isUp = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", isUp ? "text-success-600" : "text-error-500")}>
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {percentFormatter.format(Math.abs(pct))}% so với kỳ trước
    </span>
  );
}

type TripMetric = "revenue" | "cost" | "profit";

const METRIC_COLUMN: Record<TripMetric, ColumnDef<TripGroupRow>> = {
  revenue: { id: "revenue", header: () => "Doanh thu", cell: ({ row }) => <div>{currencyFormatter.format(row.original.revenue)}</div> },
  cost: { id: "cost", header: () => "Chi phí", cell: ({ row }) => <div>{currencyFormatter.format(row.original.cost)}</div> },
  profit: {
    id: "profit",
    header: () => "Lợi nhuận",
    cell: ({ row }) => (
      <div className={row.original.profit < 0 ? "text-error-500" : ""}>{currencyFormatter.format(row.original.profit)}</div>
    ),
  },
};

/**
 * Bảng gom nhóm chuyến — mỗi tab (Doanh thu/Chi phí/Lợi nhuận) chỉ hiện đúng cột số liệu của mình
 * qua `metrics`, không hiện cả 3 cột giống nhau ở mọi tab (mục 29-31 — mỗi báo cáo có phạm vi riêng).
 */
function TripGroupTable({
  rows,
  metrics,
  drillable,
  onSelectRow,
}: {
  rows: TripGroupRow[];
  metrics: TripMetric[];
  drillable?: boolean;
  onSelectRow?: (row: TripGroupRow) => void;
}) {
  const columns = useMemo<ColumnDef<TripGroupRow>[]>(
    () => [
      { id: "label", header: () => "Nhóm", cell: ({ row }) => <div className="font-medium">{row.original.label}</div> },
      { id: "tripCount", header: () => "Số chuyến", cell: ({ row }) => <div>{row.original.tripCount}</div> },
      ...metrics.map((m) => METRIC_COLUMN[m]),
    ],
    [metrics]
  );
  return (
    <DataTable
      className="w-full border"
      data={rows}
      columns={columns}
      enablePaging
      enableGlobalFilter
      enableExport
      exportFileName="Bao-cao"
      onRowClick={drillable ? onSelectRow : undefined}
    />
  );
}

function ProductRevenueTable({ rows }: { rows: ProductRevenueRow[] }) {
  const columns = useMemo<ColumnDef<ProductRevenueRow>[]>(
    () => [
      { id: "label", header: () => "Hàng hóa", cell: ({ row }) => <div className="font-medium">{row.original.label}</div> },
      { id: "quantity", header: () => "Số lượng", cell: ({ row }) => <div>{row.original.quantity}</div> },
      { id: "revenue", header: () => "Doanh thu", cell: ({ row }) => <div>{currencyFormatter.format(row.original.revenue)}</div> },
    ],
    []
  );
  return (
    <DataTable
      className="w-full border"
      data={rows}
      columns={columns}
      enablePaging
      enableGlobalFilter
      enableExport
      exportFileName="Bao-cao-doanh-thu-theo-hang-hoa"
    />
  );
}

function CostTypeTable({ rows }: { rows: CostTypeRow[] }) {
  const columns = useMemo<ColumnDef<CostTypeRow>[]>(
    () => [
      { id: "label", header: () => "Loại chi phí", cell: ({ row }) => <div className="font-medium">{row.original.label}</div> },
      { id: "amount", header: () => "Số tiền", cell: ({ row }) => <div>{currencyFormatter.format(row.original.amount)}</div> },
    ],
    []
  );
  return (
    <DataTable
      className="w-full border"
      data={rows}
      columns={columns}
      enablePaging
      enableGlobalFilter
      enableExport
      exportFileName="Bao-cao-chi-phi-theo-loai"
    />
  );
}

interface TripDetailRow {
  trip: Trip;
  route: string;
  otherCost: number;
}

/** Chi tiết từng chuyến của 1 xe/tài xế — phỏng theo sổ "Bảng kê chi tiết" theo xe trong file Excel gốc. */
function TripDetailTable({ rows }: { rows: TripDetailRow[] }) {
  const columns = useMemo<ColumnDef<TripDetailRow>[]>(
    () => [
      {
        id: "tripCode",
        header: () => "Mã chuyến",
        cell: ({ row }) => <div className="font-medium">{row.original.trip.tripCode}</div>,
        meta: { exportValue: (row) => row.trip.tripCode },
      },
      {
        id: "tripDate",
        header: () => "Ngày",
        cell: ({ row }) => <div>{row.original.trip.tripDate}</div>,
        meta: { exportValue: (row) => row.trip.tripDate },
      },
      { id: "route", header: () => "Tuyến", cell: ({ row }) => <div>{row.original.route}</div> },
      {
        id: "vendorCost",
        header: () => "Cước thuê",
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.trip.vendorCost || 0)}</div>,
        meta: { exportValue: (row) => row.trip.vendorCost || 0 },
      },
      {
        id: "driverTripSalary",
        header: () => "Lương chuyến",
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.trip.driverTripSalary || 0)}</div>,
        meta: { exportValue: (row) => row.trip.driverTripSalary || 0 },
      },
      {
        id: "fuelActualAmount",
        header: () => "Dầu thực tế",
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.trip.fuelActualAmount || 0)}</div>,
        meta: { exportValue: (row) => row.trip.fuelActualAmount || 0 },
      },
      {
        id: "fuelVarianceAmount",
        header: () => "Chênh lệch dầu",
        cell: ({ row }) => {
          const v = row.original.trip.fuelVarianceAmount || 0;
          return <div className={v > 0 ? "text-error-500" : ""}>{currencyFormatter.format(v)}</div>;
        },
        meta: { exportValue: (row) => row.trip.fuelVarianceAmount || 0 },
      },
      { id: "otherCost", header: () => "Chi phí khác", cell: ({ row }) => <div>{currencyFormatter.format(row.original.otherCost)}</div> },
      {
        id: "revenue",
        header: () => "Doanh thu",
        cell: ({ row }) => <div>{currencyFormatter.format(row.original.trip.revenue || 0)}</div>,
        meta: { exportValue: (row) => row.trip.revenue || 0 },
      },
      {
        id: "profit",
        header: () => "Lợi nhuận",
        cell: ({ row }) => (
          <div className={row.original.trip.profit < 0 ? "text-error-500" : ""}>{currencyFormatter.format(row.original.trip.profit || 0)}</div>
        ),
        meta: { exportValue: (row) => row.trip.profit || 0 },
      },
    ],
    []
  );
  return (
    <DataTable
      className="w-full border"
      data={rows}
      columns={columns}
      enablePaging
      enableGlobalFilter
      enableExport
      exportFileName="Chi-tiet-chuyen"
    />
  );
}

export default function ReportPage() {
  const { alert } = useFeedbackDialog();
  const { showLoading, hideLoading } = useLoading();

  const [tab, setTab] = useState<ReportTab>("tong-hop");
  const [dateRange, setDateRange] = useState<DateRange>(getCurrentMonthRange());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [revenueDim, setRevenueDim] = useState<string>("day");
  const [costDim, setCostDim] = useState<string>("day");
  const [profitDim, setProfitDim] = useState<string>("day");
  const [drillDown, setDrillDown] = useState<{ dimension: TripDimension; row: TripGroupRow } | null>(null);

  const customers = useReferenceData<Customer>(() => customerService.getAll(), "khách hàng");
  const vehicles = useReferenceData<Vehicle>(() => vehicleService.getAll(), "xe");
  const drivers = useReferenceData<Driver>(() => driverService.getAll(), "tài xế");
  const locations = useReferenceData<Location>(() => locationService.getAll(), "điểm nâng/hạ");
  const products = useReferenceData<Product>(() => productService.getAll(), "hàng hóa");
  const costTypes = useReferenceData<CostType>(() => costTypeService.getAll(), "loại chi phí");

  const fetchData = useCallback(async () => {
    const loadingId = showLoading(ELoadingMessages.LOADING_DATA);
    try {
      const [tripsRes, transactionsRes] = await Promise.all([tripService.getAll(), financeTransactionService.getAll()]);
      setTrips(tripsRes);
      setTransactions(transactionsRes);
    } catch (err: unknown) {
      await alert({ title: "Lỗi", content: "Lấy dữ liệu báo cáo thất bại: " + getErrorMessage(err) });
    } finally {
      hideLoading(loadingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setDrillDown(null);
  }, [dateRange, revenueDim, costDim, profitDim]);

  const tripsInRange = useMemo(() => filterTripsInRange(trips, dateRange.from, dateRange.to), [trips, dateRange]);
  const transactionsInRange = useMemo(
    () => filterTransactionsInRange(transactions, dateRange.from, dateRange.to),
    [transactions, dateRange]
  );

  const summary = useMemo(
    () => computeOverallSummary({ tripsInRange, transactionsInRange, allTrips: trips, allTransactions: transactions }),
    [tripsInRange, transactionsInRange, trips, transactions]
  );

  const previousRange = useMemo(() => getPreviousRange(dateRange.from, dateRange.to), [dateRange]);
  const previousSummary = useMemo(() => {
    const prevTrips = filterTripsInRange(trips, previousRange.from, previousRange.to);
    const prevTransactions = filterTransactionsInRange(transactions, previousRange.from, previousRange.to);
    return computeOverallSummary({
      tripsInRange: prevTrips,
      transactionsInRange: prevTransactions,
      allTrips: trips,
      allTransactions: transactions,
    });
  }, [trips, transactions, previousRange]);

  const refs = useMemo(() => ({ customers, vehicles, drivers, locations }), [customers, vehicles, drivers, locations]);

  const monthlyTrend: MonthlyTrendRow[] = useMemo(
    () => computeMonthlyTrend(trips, dateRange.from, dateRange.to),
    [trips, dateRange]
  );
  const topCustomers = useMemo(
    () => groupTrips(tripsInRange, "customer", refs).slice(0, 8).map((r) => ({ label: r.label, value: r.revenue })),
    [tripsInRange, refs]
  );
  const topVehicles = useMemo(
    () => groupTrips(tripsInRange, "vehicle", refs).slice(0, 8).map((r) => ({ label: r.label, value: r.revenue })),
    [tripsInRange, refs]
  );

  const revenueRows = useMemo(
    () =>
      revenueDim === "product"
        ? groupRevenueByProduct(tripsInRange, products)
        : groupTrips(tripsInRange, revenueDim as TripDimension, refs),
    [revenueDim, tripsInRange, products, refs]
  );
  const costRows = useMemo(
    () =>
      costDim === "costType"
        ? groupCostByType(tripsInRange, transactionsInRange, costTypes)
        : groupTrips(tripsInRange, costDim as TripDimension, refs),
    [costDim, tripsInRange, transactionsInRange, costTypes, refs]
  );
  const profitRows = useMemo(() => groupTrips(tripsInRange, profitDim as TripDimension, refs), [profitDim, tripsInRange, refs]);

  // Biểu đồ "nguồn/từ đâu" cho từng tab — top 8 theo đúng số liệu của tab đó (không phải luôn sắp theo
  // doanh thu như bảng gốc), để thấy ngay phần lớn doanh thu/chi phí/lợi nhuận đến từ đâu, không chỉ
  // đọc bảng số thô.
  const revenueChartData = useMemo(
    () => revenueRows.slice(0, 8).map((r) => ({ label: r.label, value: r.revenue })),
    [revenueRows]
  );
  const costChartData = useMemo(
    () =>
      costDim === "costType"
        ? (costRows as CostTypeRow[]).map((r) => ({ label: r.label, value: r.amount }))
        : (costRows as TripGroupRow[])
            .slice()
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 8)
            .map((r) => ({ label: r.label, value: r.cost })),
    [costRows, costDim]
  );
  const profitChartData = useMemo(
    () =>
      profitRows
        .slice()
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 8)
        .map((r) => ({ label: r.label, value: r.profit })),
    [profitRows]
  );

  const drillDownRows: TripDetailRow[] = useMemo(() => {
    if (!drillDown) return [];
    const field = drillDown.dimension === "vehicle" ? "vehicleId" : "driverId";
    const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
    return tripsInRange
      .filter((t) => t[field] === drillDown.row.key)
      .map((trip) => ({
        trip,
        route: `${locationName(trip.pickupLocationId)} → ${locationName(trip.dropoffLocationId)}`,
        otherCost: trip.costs.filter((c) => !c.isFuel).reduce((s, c) => s + (c.amount || 0), 0),
      }));
  }, [drillDown, tripsInRange, locations]);

  const kpiCards: (KpiCardData & { previous?: number })[] = [
    { label: "Số chuyến", value: summary.tripCount, previous: previousSummary.tripCount, icon: Truck },
    { label: "Doanh thu", value: summary.revenue, previous: previousSummary.revenue, icon: TrendingUp },
    { label: "Chi phí", value: summary.cost, previous: previousSummary.cost, icon: Receipt },
    {
      label: "Lợi nhuận",
      value: summary.profit,
      previous: previousSummary.profit,
      icon: PiggyBank,
      highlight: summary.profit < 0 ? "error" : "success",
    },
    { label: "Công nợ phải thu", value: summary.totalReceivable, icon: HandCoins },
    { label: "Công nợ phải trả", value: summary.totalPayable, icon: Landmark },
    { label: "Tổng thu", value: summary.totalReceipt, previous: previousSummary.totalReceipt, icon: ArrowDownCircle },
    { label: "Tổng chi", value: summary.totalPayment, previous: previousSummary.totalPayment, icon: ArrowUpCircle },
    {
      label: "Số dư",
      value: summary.balance,
      previous: previousSummary.balance,
      icon: Wallet,
      highlight: summary.balance < 0 ? "error" : "success",
    },
  ];

  const renderDimensionTable = (dimension: string, dims: TripDimension[], rows: TripGroupRow[], metrics: TripMetric[]) => {
    const isDrillable = DRILLABLE_DIMENSIONS.includes(dimension as TripDimension) && dims.includes(dimension as TripDimension);
    return (
      <>
        <TripGroupTable
          rows={rows}
          metrics={metrics}
          drillable={isDrillable}
          onSelectRow={(row) => setDrillDown({ dimension: dimension as TripDimension, row })}
        />
        {isDrillable && drillDown && drillDown.dimension === dimension && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-2 flex flex-col gap-2 shrink-0 max-h-80">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Chi tiết từng chuyến — {drillDown.row.label}</p>
              <div className="flex items-center gap-1">
                {drillDown.dimension === "vehicle" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void exportVehicleStatementToExcel(drillDown.row.label, drillDownRows)}
                    className="flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Xuất Excel
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => setDrillDown(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <TripDetailTable rows={drillDownRows} />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white px-2 overflow-hidden dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="shrink-0 mb-2 mt-2 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">Báo cáo</h3>
        <div className="shrink-0">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      <div className="shrink-0 mb-2 flex items-center gap-1 flex-wrap">
        {(Object.keys(TAB_LABEL) as ReportTab[]).map((t) => {
          const TabIcon = TAB_ICON[t];
          return (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5"
            >
              <TabIcon className="h-3.5 w-3.5" />
              {TAB_LABEL[t]}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pb-4 gap-4">
        {tab === "tong-hop" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {kpiCards.map((card) => (
                <KpiCard
                  key={card.label}
                  card={card}
                  extra={card.previous !== undefined && <DeltaBadge current={card.value} previous={card.previous} />}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
                <LineChart className="h-4 w-4 text-brand-500" />
                Doanh thu / Chi phí / Lợi nhuận theo tháng (12 tháng gần nhất)
              </p>
              <MonthlyTrendChart data={monthlyTrend} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
                  <Users className="h-4 w-4 text-brand-500" />
                  Doanh thu theo khách hàng (top 8, trong kỳ)
                </p>
                {topCustomers.length > 0 ? <TopBarChart data={topCustomers} /> : <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>}
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90 mb-2">
                  <Truck className="h-4 w-4 text-brand-500" />
                  Doanh thu theo xe (top 8, trong kỳ)
                </p>
                {topVehicles.length > 0 ? <TopBarChart data={topVehicles} /> : <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>}
              </div>
            </div>
          </>
        )}

        {tab === "doanh-thu" && (
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Tổng doanh thu trong kỳ</p>
                  <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(summary.revenue)}</p>
                </div>
                <DeltaBadge current={summary.revenue} previous={previousSummary.revenue} />
              </div>
              <p className="text-xs text-gray-400 mb-1">Nguồn doanh thu — top 8 theo lựa chọn bên dưới</p>
              {revenueChartData.length > 0 ? (
                <TopBarChart data={revenueChartData} seriesName="Doanh thu" />
              ) : (
                <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
              )}
            </div>
            <Select
              options={dimensionOptions(REVENUE_DIMENSIONS, { value: "product", label: "Theo hàng hóa" })}
              value={revenueDim}
              onChange={setRevenueDim}
              className="w-56 shrink-0"
            />
            {revenueDim === "product" ? (
              <ProductRevenueTable rows={revenueRows as ProductRevenueRow[]} />
            ) : (
              renderDimensionTable(revenueDim, REVENUE_DIMENSIONS, revenueRows as TripGroupRow[], ["revenue"])
            )}
          </div>
        )}

        {tab === "chi-phi" && (
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Tổng chi phí trong kỳ</p>
                  <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{currencyFormatter.format(summary.cost)}</p>
                </div>
                <DeltaBadge current={summary.cost} previous={previousSummary.cost} />
              </div>
              <p className="text-xs text-gray-400 mb-1">
                {costDim === "costType" ? "Tỉ trọng chi phí theo loại" : "Nguồn chi phí — top 8 theo lựa chọn bên dưới"}
              </p>
              {costChartData.length > 0 ? (
                costDim === "costType" ? (
                  <DonutChart data={costChartData} />
                ) : (
                  <TopBarChart data={costChartData} seriesName="Chi phí" color="#f04438" />
                )
              ) : (
                <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
              )}
            </div>
            <Select
              options={dimensionOptions(COST_DIMENSIONS, { value: "costType", label: "Theo loại chi phí" })}
              value={costDim}
              onChange={setCostDim}
              className="w-56 shrink-0"
            />
            {costDim === "costType" ? (
              <CostTypeTable rows={costRows as CostTypeRow[]} />
            ) : (
              renderDimensionTable(costDim, COST_DIMENSIONS, costRows as TripGroupRow[], ["cost"])
            )}
          </div>
        )}

        {tab === "loi-nhuan" && (
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Lợi nhuận trong kỳ</p>
                  <p className={`text-lg font-semibold ${summary.profit < 0 ? "text-error-500" : "text-success-600"}`}>
                    {currencyFormatter.format(summary.profit)}
                  </p>
                </div>
                <DeltaBadge current={summary.profit} previous={previousSummary.profit} />
              </div>
              <p className="text-xs text-gray-400 mb-1">Nguồn lợi nhuận — top 8 theo lựa chọn bên dưới</p>
              {profitChartData.length > 0 ? (
                <TopBarChart data={profitChartData} seriesName="Lợi nhuận" color="#039855" />
              ) : (
                <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
              )}
            </div>
            <Select options={dimensionOptions(PROFIT_DIMENSIONS)} value={profitDim} onChange={setProfitDim} className="w-56 shrink-0" />
            {renderDimensionTable(profitDim, PROFIT_DIMENSIONS, profitRows, ["revenue", "cost", "profit"])}
          </div>
        )}
      </div>
    </div>
  );
}
