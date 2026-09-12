"use client";

import { useTheme } from "@/context/ThemeContext";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

// ApexCharts đọc `window` khi khởi tạo — phải tắt SSR, nếu không build sẽ lỗi (mục 51: không phá
// hành vi hiện tại của app khi thêm thư viện mới cần DOM).
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const currencyCompact = new Intl.NumberFormat("vi-VN", { notation: "compact" });
const currencyFull = new Intl.NumberFormat("vi-VN");

const BRAND_COLOR = "#465fff"; // --color-brand-500
const ERROR_COLOR = "#f04438"; // --color-error-500
const SUCCESS_COLOR = "#039855"; // --color-success-600

function useChartBaseOptions(): Partial<ApexOptions> {
  const { theme } = useTheme();
  return {
    chart: { fontFamily: "inherit", toolbar: { show: false }, background: "transparent" },
    theme: { mode: theme },
    grid: { borderColor: theme === "dark" ? "#1f2937" : "#f0f1f2" },
  };
}

export function MonthlyTrendChart({ data }: { data: { month: string; revenue: number; cost: number; profit: number }[] }) {
  const base = useChartBaseOptions();
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "line" },
    stroke: { curve: "smooth", width: [0, 0, 3] },
    colors: [BRAND_COLOR, ERROR_COLOR, SUCCESS_COLOR],
    plotOptions: { bar: { columnWidth: "45%", borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: { categories: data.map((d) => d.month) },
    yaxis: { labels: { formatter: (v: number) => currencyCompact.format(v) } },
    legend: { position: "top" },
    tooltip: { y: { formatter: (v: number) => currencyFull.format(v) } },
  };
  const series = [
    { name: "Doanh thu", type: "column", data: data.map((d) => d.revenue) },
    { name: "Chi phí", type: "column", data: data.map((d) => d.cost) },
    { name: "Lợi nhuận", type: "line", data: data.map((d) => d.profit) },
  ];
  return <ReactApexChart options={options} series={series} type="line" height={300} />;
}

export function TopBarChart({
  data,
  seriesName = "Doanh thu",
  color = BRAND_COLOR,
}: {
  data: { label: string; value: number }[];
  /** Tên chuỗi số liệu hiện trong tooltip/chú thích — đổi theo tab đang xem (Doanh thu/Chi phí/Lợi nhuận). */
  seriesName?: string;
  /** Màu cột — mặc định xanh thương hiệu (doanh thu); dùng đỏ cho chi phí, xanh lá cho lợi nhuận. */
  color?: string;
}) {
  const base = useChartBaseOptions();
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "bar" },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "60%", distributed: false } },
    dataLabels: { enabled: false },
    colors: [color],
    xaxis: {
      categories: data.map((d) => d.label),
      labels: { formatter: (v) => currencyCompact.format(Number(v)) },
    },
    tooltip: { y: { formatter: (v: number) => currencyFull.format(v) } },
  };
  const series = [{ name: seriesName, data: data.map((d) => d.value) }];
  return <ReactApexChart options={options} series={series} type="bar" height={Math.max(220, data.length * 38)} />;
}

const DONUT_PALETTE = [
  "#465fff",
  "#f04438",
  "#039855",
  "#f79009",
  "#7a5af8",
  "#0ba5ec",
  "#dd2590",
  "#84adff",
  "#98a2b3",
  "#f97066",
];

/** Biểu đồ tròn tỉ trọng theo nhóm (vd chi phí theo loại) — trả lời "nguồn/từ đâu" trực quan hơn bảng số. */
export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const base = useChartBaseOptions();
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "donut" },
    labels: data.map((d) => d.label),
    colors: DONUT_PALETTE,
    legend: { position: "bottom" },
    dataLabels: { enabled: true, formatter: (v: number) => `${v.toFixed(1)}%` },
    tooltip: { y: { formatter: (v: number) => currencyFull.format(v) } },
  };
  const series = data.map((d) => d.value);
  return <ReactApexChart options={options} series={series} type="donut" height={280} />;
}
