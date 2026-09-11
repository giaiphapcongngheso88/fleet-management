import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createCrudService } from "@/lib/firestoreCrud";
import { format, parseISO } from "date-fns";
import { getNextSequence } from "@/lib/sequence";
import { FinanceTransaction, TransactionType } from "@/types/finance";
import { Trip, TripStatus } from "@/types/trip";

// Dữ liệu giao dịch — KHÔNG bật cache (mục 2.4: chỉ cache danh mục/bảng giá).
export const financeTransactionService = createCrudService<FinanceTransaction>("finance_transactions");

const RECEIVABLE_STATUSES: TripStatus[] = ["COMPLETED", "RECONCILED"];

/** Sinh mã phiếu PT-yyyyMM-00001 / PC-yyyyMM-00001 (mục 43). */
export async function generateTransactionNo(type: TransactionType, transactionDate: string): Promise<string> {
  const monthKey = format(parseISO(transactionDate), "yyyyMM");
  const prefix = type === "RECEIPT" ? "PT" : "PC";
  const seq = await getNextSequence(`${type === "RECEIPT" ? "receipt" : "payment"}-${monthKey}`);
  return `${prefix}-${monthKey}-${String(seq).padStart(5, "0")}`;
}

export interface TripLedgerRow {
  trip: Trip;
  /** Tổng các phiếu đã gắn đúng vào chuyến này. */
  paid: number;
  remaining: number;
}

export interface LedgerResult {
  rows: TripLedgerRow[];
  /** Tổng các phiếu thu/chi không gắn vào chuyến cụ thể nào (thanh toán chung / ứng trước). */
  unlinkedPayments: number;
  totalRevenue: number;
  totalPaid: number;
  balance: number;
}

async function computeLedger(params: {
  tripField: "customerId" | "vendorId";
  objectId: string;
  amountField: "revenue" | "vendorCost";
  transactionType: TransactionType;
  objectType: "CUSTOMER" | "VENDOR";
}): Promise<LedgerResult> {
  const { tripField, objectId, amountField, transactionType, objectType } = params;

  const tripsSnap = await getDocs(query(collection(db, "trips"), where(tripField, "==", objectId)));
  const trips = tripsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Trip)
    .filter((t) => RECEIVABLE_STATUSES.includes(t.status));

  const paymentsSnap = await getDocs(
    query(
      collection(db, "finance_transactions"),
      where("objectType", "==", objectType),
      where("objectId", "==", objectId),
      where("type", "==", transactionType)
    )
  );
  const payments = paymentsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FinanceTransaction)
    .filter((p) => p.status === "ACTIVE");

  let unlinkedPayments = 0;
  const paidByTripId = new Map<string, number>();
  for (const payment of payments) {
    if (payment.tripId) {
      paidByTripId.set(payment.tripId, (paidByTripId.get(payment.tripId) ?? 0) + payment.amount);
    } else {
      unlinkedPayments += payment.amount;
    }
  }

  const rows: TripLedgerRow[] = trips.map((trip) => {
    const amount = (trip[amountField] as number) ?? 0;
    const paid = paidByTripId.get(trip.id) ?? 0;
    return { trip, paid, remaining: amount - paid };
  });

  const totalRevenue = rows.reduce((sum, r) => sum + ((r.trip[amountField] as number) ?? 0), 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.paid, 0) + unlinkedPayments;

  return {
    rows,
    unlinkedPayments,
    totalRevenue,
    totalPaid,
    balance: totalRevenue - totalPaid,
  };
}

/** Công nợ khách hàng (mục 21) — SUM(revenue chuyến COMPLETED/RECONCILED) - SUM(Phiếu thu). */
export function computeCustomerReceivable(customerId: string): Promise<LedgerResult> {
  return computeLedger({
    tripField: "customerId",
    objectId: customerId,
    amountField: "revenue",
    transactionType: "RECEIPT",
    objectType: "CUSTOMER",
  });
}

/** Công nợ đơn vị vận tải (mục 23) — SUM(vendorCost chuyến COMPLETED/RECONCILED) - SUM(Phiếu chi). */
export function computeVendorPayable(vendorId: string): Promise<LedgerResult> {
  return computeLedger({
    tripField: "vendorId",
    objectId: vendorId,
    amountField: "vendorCost",
    transactionType: "PAYMENT",
    objectType: "VENDOR",
  });
}

export interface FinanceSummary {
  totalReceipt: number;
  totalPayment: number;
  balance: number;
}

/** Sổ thu chi (mục 20) — chỉ tổng hợp từ danh sách giao dịch đã tải, không tạo nguồn dữ liệu mới. */
export function getFinanceSummary(transactions: FinanceTransaction[]): FinanceSummary {
  const active = transactions.filter((t) => t.status === "ACTIVE");
  const totalReceipt = active.filter((t) => t.type === "RECEIPT").reduce((sum, t) => sum + t.amount, 0);
  const totalPayment = active.filter((t) => t.type === "PAYMENT").reduce((sum, t) => sum + t.amount, 0);
  return { totalReceipt, totalPayment, balance: totalReceipt - totalPayment };
}
