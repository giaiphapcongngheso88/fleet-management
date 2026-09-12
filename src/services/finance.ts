import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createCrudService } from "@/lib/firestoreCrud";
import { format, parseISO } from "date-fns";
import { getNextSequence, getSequencePrefix } from "@/lib/sequence";
import { FinanceTransaction, TransactionType } from "@/types/finance";
import { DebtReconciliation, DebtReconciliationObjectType } from "@/types/debt-reconciliation";
import { Trip, TripStatus } from "@/types/trip";

// Dữ liệu giao dịch — KHÔNG bật cache (mục 2.4: chỉ cache danh mục/bảng giá).
export const financeTransactionService = createCrudService<FinanceTransaction>("finance_transactions");
export const debtReconciliationService = createCrudService<DebtReconciliation>("debt_reconciliations");

export async function getDebtReconciliations(
  objectType: DebtReconciliationObjectType,
  objectId: string
): Promise<DebtReconciliation[]> {
  const snap = await getDocs(
    query(
      collection(db, "debt_reconciliations"),
      where("objectType", "==", objectType),
      where("objectId", "==", objectId)
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DebtReconciliation)
    .sort((a, b) => b.reconciliationDate.localeCompare(a.reconciliationDate));
}

const RECEIVABLE_STATUSES: TripStatus[] = ["COMPLETED", "RECONCILED"];

/** Sinh mã phiếu PT-yyyyMM-00001 / PC-yyyyMM-00001 (mục 43). */
export async function generateTransactionNo(type: TransactionType, transactionDate: string): Promise<string> {
  const monthKey = format(parseISO(transactionDate), "yyyyMM");
  const prefix = await getSequencePrefix(type === "RECEIPT" ? "receipt" : "payment", type === "RECEIPT" ? "PT" : "PC");
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

export interface DebtSummaryRow {
  id: string;
  objectType: "CUSTOMER" | "VENDOR";
  objectId: string;
  partnerName: string;
  incurred: number;
  paid: number;
  balance: number;
}

export async function computeDebtSummary(asOfDate?: string): Promise<DebtSummaryRow[]> {
  const [tripsSnap, transactionsSnap] = await Promise.all([
    getDocs(collection(db, "trips")),
    getDocs(collection(db, "finance_transactions")),
  ]);
  const trips = tripsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Trip)
    .filter((trip) => RECEIVABLE_STATUSES.includes(trip.status) && (!asOfDate || trip.tripDate <= asOfDate));
  const transactions = transactionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FinanceTransaction)
    .filter((transaction) => transaction.status === "ACTIVE" && (!asOfDate || transaction.transactionDate <= asOfDate));

  const rows = new Map<string, DebtSummaryRow>();
  const addRow = (objectType: DebtSummaryRow["objectType"], objectId: string, incurred: number, paid: number) => {
    const key = `${objectType}:${objectId}`;
    const current = rows.get(key) ?? {
      id: key,
      objectType,
      objectId,
      partnerName: objectId,
      incurred: 0,
      paid: 0,
      balance: 0,
    };
    current.incurred += incurred;
    current.paid += paid;
    current.balance = current.incurred - current.paid;
    rows.set(key, current);
  };

  for (const trip of trips) {
    if (trip.customerId) addRow("CUSTOMER", trip.customerId, trip.revenue ?? 0, 0);
    if (trip.vendorId) addRow("VENDOR", trip.vendorId, trip.vendorCost ?? 0, 0);
  }
  for (const transaction of transactions) {
    if (transaction.objectType === "CUSTOMER" && transaction.type === "RECEIPT" && transaction.objectId) {
      addRow("CUSTOMER", transaction.objectId, 0, transaction.amount);
    }
    if (transaction.objectType === "VENDOR" && transaction.type === "PAYMENT" && transaction.objectId) {
      addRow("VENDOR", transaction.objectId, 0, transaction.amount);
    }
  }
  return [...rows.values()];
}

async function computeLedger(params: {
  tripField: "customerId" | "vendorId";
  objectId: string;
  amountField: "revenue" | "vendorCost";
  transactionType: TransactionType;
  objectType: "CUSTOMER" | "VENDOR";
  asOfDate?: string;
}): Promise<LedgerResult> {
  const { tripField, objectId, amountField, transactionType, objectType, asOfDate } = params;

  const tripsSnap = await getDocs(query(collection(db, "trips"), where(tripField, "==", objectId)));
  const trips = tripsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Trip)
    .filter((t) => RECEIVABLE_STATUSES.includes(t.status) && (!asOfDate || t.tripDate <= asOfDate));

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
    .filter((p) => p.status === "ACTIVE" && (!asOfDate || p.transactionDate <= asOfDate));

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
export function computeCustomerReceivable(customerId: string, asOfDate?: string): Promise<LedgerResult> {
  return computeLedger({
    tripField: "customerId",
    objectId: customerId,
    amountField: "revenue",
    transactionType: "RECEIPT",
    objectType: "CUSTOMER",
    asOfDate,
  });
}

/** Công nợ đơn vị vận tải (mục 23) — SUM(vendorCost chuyến COMPLETED/RECONCILED) - SUM(Phiếu chi). */
export function computeVendorPayable(vendorId: string, asOfDate?: string): Promise<LedgerResult> {
  return computeLedger({
    tripField: "vendorId",
    objectId: vendorId,
    amountField: "vendorCost",
    transactionType: "PAYMENT",
    objectType: "VENDOR",
    asOfDate,
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
