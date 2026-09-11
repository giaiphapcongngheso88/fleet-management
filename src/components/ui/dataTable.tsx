/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
    Column,
    ColumnDef,
    ColumnFiltersState,
    FilterFn,
    filterFns,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFacetedMinMaxValues,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getGroupedRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    Getter,
    Table as ReactTable,
    Row,
    RowData,
    sortingFns,
    SortingState,
    TableOptions,
    useReactTable,
    VisibilityState,
} from "@tanstack/react-table";

import { cn, normalizeString } from "@/app/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { STATUS_LABEL } from "@/types/common";
import { PAYROLL_PERIOD_STATUS_LABEL } from "@/types/payroll";
import { TRIP_STATUS_LABEL } from "@/types/trip";

import { Checkbox } from "@/components/ui/checkbox";
import {
    DeprecatedTableBody,
    DeprecatedTableCell,
    DeprecatedTableFooter,
    DeprecatedTableHead,
    DeprecatedTableHeader,
    DeprecatedTableRow,
    DeprecatedTable as Table,
} from "@/components/ui/deprecated_table";

import {
    CaretDownIcon,
    CaretSortIcon,
    CaretUpIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    DoubleArrowLeftIcon,
    DoubleArrowRightIcon,
    MagnifyingGlassIcon,
    MixerHorizontalIcon,
} from "@radix-ui/react-icons";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { isValid, parse, parseISO } from "date-fns";
import { FilterIcon, SquareArrowOutUpRight } from "lucide-react";
import {
    CSSProperties,
    Fragment,
    KeyboardEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Button } from "./button";

import { Input } from "./input";
import { Popover, PopoverContent } from "./popover";
import { DATE_FORMAT } from "@/app/lib/enums";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { Select } from "./select/select";
import Spinner from "./spinner";
import { Textarea } from "./textarea";

declare module "@tanstack/table-core" {
    interface FilterFns {
        isBoolean: FilterFn<unknown>;
    }
}
declare module "@tanstack/react-table" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        filterVariant?: "text" | "range" | "select";
        showGroupFooter?: boolean;
        groupFooterValue?: string;
        groupFooterFn?: (item: TData) => string;
        className?: string;
        titleToggleColumn?: string;
        enableColumnFilterDropdown?: boolean;
    }

    interface TableMeta<TData extends RowData> {
        updateData: (rowIndex: number, columnId: string, value: unknown) => void;
        updateDataByObject: (
            rowIndex: number,
            updateObject: Partial<TData>,
        ) => void;
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DataTableProps<TData, TNestedData, TValue> {
    className?: string;
    tableClassName?: string;
    enableColumnFilter?: boolean;
    isLoading?: boolean;
    enablePaging?: boolean;
    enableArrowFocus?: boolean;
    enableToggleColumn?: boolean;
    enableGrouping?: boolean;
    groupSortAscending?: boolean;
    enableGroupFooter?: boolean;
    enableFooter?: boolean;
    expanded?: boolean;
    hasSubRows?: boolean;
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    groupBy?: (row: TData) => string;
    onRowClick?: (row: TData, index: number) => void;
    onRowDoubleClick?: (row: TData, index: number) => void;
    indexScrollTo?: number;
    enableScrollTo?: boolean;
    enableGlobalFilter?: boolean;
    columnVisibilityInit?: VisibilityState;
    getRowColor?: (row: TData) => CSSProperties;
    tHeadClass?: string;
    tRowClass?: string;
    globalFilterFn?: (
        rows: Row<TData>,
        columnId: string,
        filterValue: string,
    ) => boolean;
    viewSubRows?: (row: TData) => void;
    onFilteredRowCountChange?: (filteredData: Row<TData>[]) => void;
    onGroupClick?: (data: string) => void;
    placeholderSearch?: string;
    onChange?: (data: TData[]) => void;
    getRowClassName?: (row: TData, index: number) => string;
    onDataChange?: (data: TData[]) => void;
    id?: string;
    isSelectRowWhenUseArrowKey?: boolean;
    selectRowClass?: string;
    initialGlobalFilter?: string;
    isResetColumnFilter?: boolean;
    columnPinning?: string[];
    initialColumnFilters?: ColumnFiltersState;
    viewOptionsContentClassName?: string;
}

const dateFormats = Object.values(DATE_FORMAT);

/**
 * Gộp toàn bộ nhãn trạng thái đang dùng trong app (EntityStatus + TripStatus...) để cột "status"
 * ở bất kỳ trang nào cũng hiển thị đúng nhãn tiếng Việt trong dropdown lọc, không cần khai báo lại
 * ở từng trang — các bộ enum không trùng khóa (hoặc trùng nghĩa như DRAFT) nên gộp an toàn.
 */
const STATUS_FILTER_LABELS: Record<string, string> = {
    ...STATUS_LABEL,
    ...TRIP_STATUS_LABEL,
    ...PAYROLL_PERIOD_STATUS_LABEL,
};

const getCommonPinningStyles = <TData,>(
    column: Column<TData>,
    backgroundColor?: string,
): CSSProperties => {
    const isPinned = column.getIsPinned();

    return {
        backgroundColor: isPinned ? backgroundColor : undefined,
        boxShadow: isPinned ? "-2px 0 2px -2px gray inset" : undefined,
        left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
        position: isPinned ? "sticky" : undefined,
        width: column.getSize(),
        zIndex: isPinned ? 1 : 0,
        border: "1px solid  #e5e7eb",
    };
};

export function DataTable<TData, TNestedData, TValue>({
    className,
    tableClassName,
    enableColumnFilter = true,
    isLoading = false,
    enablePaging = true,
    enableToggleColumn = true,
    enableGrouping = false,
    groupSortAscending = true,
    enableGroupFooter = false,
    enableFooter = false,
    expanded = true,
    hasSubRows = false,
    enableArrowFocus = false,
    columns,
    data,
    groupBy,
    onRowClick,
    onRowDoubleClick,
    indexScrollTo,
    enableScrollTo = true,
    enableGlobalFilter,
    columnVisibilityInit,
    getRowColor,
    tHeadClass,
    tRowClass,
    globalFilterFn,
    viewSubRows,
    onFilteredRowCountChange,
    onGroupClick,
    placeholderSearch,
    onChange,
    getRowClassName,
    onDataChange,
    id,
    isSelectRowWhenUseArrowKey,
    selectRowClass,
    initialGlobalFilter,
    isResetColumnFilter,
    columnPinning,
    initialColumnFilters,
    viewOptionsContentClassName,
}: DataTableProps<TData, TNestedData, TValue>) {
    const [isMounted, setIsMouned] = useState<boolean>(false);
    // Mục 48.1 spec nghiệp vụ: dưới breakpoint mobile chuyển bảng -> thẻ, không cài riêng từng
    // trang. enableGrouping/hasSubRows chưa có card tương ứng (chưa trang nào dùng) nên vẫn giữ bảng.
    const isMobile = useIsMobile();
    const showCardView = isMobile && !enableGrouping && !hasSubRows;
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const rowScrollToRef = useRef<HTMLTableRowElement | null>(null);
    const indexScrollToPrevRef = useRef<number | undefined>(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
        initialColumnFilters ?? [],
    );
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        columnVisibilityInit || {},
    );
    const [rowSelection, setRowSelection] = useState({});
    const [selectedRow, setSelectedRow] = useState<TData | null>(
        indexScrollTo ? data[indexScrollTo] || null : null,
    );
    const [selectedGroup, setSelectedGroup] = useState<string>("");
    const [globalFilter, setGlobalFilter] = useState<string>(
        initialGlobalFilter || "",
    );
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 50,
    });

    const groupedData = useMemo(() => {
        if (!groupBy) return {};

        const grouped = data.reduce(
            (acc, row) => {
                const group = groupBy(row);
                if (!acc[group]) {
                    acc[group] = [];
                }
                acc[group].push(row);
                return acc;
            },
            {} as { [key: string]: TData[] },
        );
        if (sorting.length) {

            const { id, desc } = sorting[0];
            Object.values(grouped).forEach((group) => {
                group.sort((a, b) => {
                    const aValue = a[id as keyof TData];
                    const bValue = b[id as keyof TData];

                    if (typeof aValue === "string" && typeof bValue === "string") {
                        return desc
                            ? bValue.localeCompare(aValue)
                            : aValue.localeCompare(bValue);
                    }

                    if (typeof aValue === "number" && typeof bValue === "number") {
                        return desc ? bValue - aValue : aValue - bValue;
                    }

                    return 0;
                });
            });
        }
        return grouped;
    }, [data, groupBy, sorting]);

    const [expandedGroups, setExpandedGroups] = useState<{
        [key: string]: boolean;
    }>({});

    useEffect(() => {
        const initialExpandedGroups = Object.keys(groupedData).reduce(
            (acc, groupName) => {
                acc[groupName] = expanded;
                return acc;
            },
            {} as { [key: string]: boolean },
        );

        setExpandedGroups(initialExpandedGroups);
        // TODO(https://rm.vnvc.info/issues/92105): Fix and remove disable comment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupedData]);

    const tableState = useMemo(() => {
        return {
            sorting,
            pagination,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter,
            columnPinning: columnPinning
                ? {
                    left: columnPinning,
                }
                : {},
        };
    }, [
        sorting,
        pagination,
        columnFilters,
        columnVisibility,
        rowSelection,
        globalFilter,
        columnPinning,
    ]);

    const configReactTable: TableOptions<TData> = {
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getExpandedRowModel: getExpandedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        getFacetedMinMaxValues: getFacetedMinMaxValues(),
        getGroupedRowModel: enableGrouping ? getGroupedRowModel() : undefined,
        getRowCanExpand: () => true,
        state: tableState,
        autoResetPageIndex: false,
        onPaginationChange: setPagination,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn,
        meta: {
            updateData: (rowIndex: number, columnId: string, value: unknown) => {
                const updateData = [...data];

                updateData[rowIndex] = {
                    ...updateData[rowIndex],
                    [columnId]: value,
                };
                onChange?.(updateData);
            },
            updateDataByObject: (rowIndex: number, updateObject: Partial<TData>) => {
                const updateData = [...data];

                updateData[rowIndex] = {
                    ...updateData[rowIndex],
                    ...updateObject,
                };
                onChange?.(updateData);
            },
        },
        filterFns: {
            ...filterFns,
            isBoolean: (row, columnId, value) =>
                Boolean(row.getValue(columnId)) === value,
        },
        sortingFns: {
            ...sortingFns,
            datetime: (rowA: Row<TData>, rowB: Row<TData>, columnId: string) => {
                let dateA: Date | null = null;
                let dateB: Date | null = null;
                const rowValueA = rowA.getValue(columnId) as string;
                const rowValueB = rowB.getValue(columnId) as string;

                for (const formatStr of dateFormats) {
                    // Use parseISO in case date value is "yyyy-MM-dd'T'HH:mm:ss.SSS"
                    const isISO8601 = formatStr === DATE_FORMAT.ISO_8601;
                    if (!dateA && rowValueA) {
                        const parsedDateA = isISO8601
                            ? parseISO(rowValueA)
                            : parse(rowValueA, formatStr, new Date());
                        if (isValid(parsedDateA)) {
                            dateA = parsedDateA;
                        }
                    }

                    if (!dateB && rowValueB) {
                        const parsedDateB = isISO8601
                            ? parseISO(rowValueB)
                            : parse(rowValueB, formatStr, new Date());
                        if (isValid(parsedDateB)) {
                            dateB = parsedDateB;
                        }
                    }

                    if (dateA && dateB) break;
                }

                return dateA && dateB ? dateA.getTime() - dateB.getTime() : 0;
            },
        },
    };

    if (!globalFilterFn) {
        delete configReactTable["globalFilterFn"];
    }

    const table = useReactTable(configReactTable);
    const rowCount = table.getRowCount();

    useEffect(() => {
        setPagination((prev) => ({
            ...prev,
            pageIndex: 0,
        }));
    }, [rowCount]);

    // TODO: This rowCount is temporary solution for onFilteredRowCountChange cause re-render.
    // This function should be removed in the future, because this function use for get filtered row not number of row.
    useEffect(() => {
        if (onFilteredRowCountChange) {
            const filteredRows = table.getFilteredRowModel().rows;
            onFilteredRowCountChange(filteredRows);
        }
        // TODO(https://rm.vnvc.info/issues/92105): Fix and remove disable comment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowCount, table]);

    useEffect(() => {
        if (isResetColumnFilter) table.resetColumnFilters();
        // TODO(https://rm.vnvc.info/issues/92105): Fix and remove disable comment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, isResetColumnFilter]);

    useEffect(() => {
        setColumnFilters(initialColumnFilters || []);
    }, [initialColumnFilters]);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupName]: !prev[groupName],
        }));
    };

    const handleRowClick = (row: TData, index: number) => {
        setSelectedGroup("");
        setSelectedRow(row);
        if (onRowClick) {
            onRowClick(row, index);
        }
    };

    const handleViewSubRows = (row: TData) => {
        if (viewSubRows) {
            viewSubRows(row);
        }
    };

    const getRowStyle = (row: TData) => {
        const originalRow = tableData.find((r) => r.original === row);
        if (!originalRow) return { originalRow, style: {} as CSSProperties };
        const style = getRowColor ? getRowColor(originalRow.original) : {};
        return { originalRow, style };
    };

    const tableData = enablePaging
        ? table.getRowModel().rows
        : table.getSortedRowModel().rows;

    useEffect(() => {
        if (onDataChange) {
            onDataChange(tableData.map((row) => row.original));
        }
        // TODO(https://rm.vnvc.info/issues/92105): Fix and remove disable comment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData]);

    useEffect(() => {
        const prevIndex = indexScrollToPrevRef.current;
        const currentIndex = indexScrollTo;
        indexScrollToPrevRef.current = indexScrollTo;
        if (
            indexScrollTo !== undefined &&
            indexScrollTo >= 0 &&
            data &&
            data.length > indexScrollTo
        ) {
            if (enableScrollTo) {
                rowScrollToRef.current?.scrollIntoView({
                    block: "center",
                    behavior: "smooth",
                });
            }
            setSelectedRow(data[indexScrollTo] || null);
        } else if (currentIndex === undefined && currentIndex !== prevIndex) {
            setSelectedRow(null);
        }
    }, [indexScrollTo, data, enableScrollTo]);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (handleRowClick) {
            const index = tableData.findIndex((x) => x.original === selectedRow);
            const currentRow = tableData[index];
            if (e.key === "Enter" && currentRow && !enableArrowFocus) {
                handleRowClick(currentRow.original, index);
            }
            if (e.key === "ArrowDown") {
                const row = tableData[index + 1];
                if (row && !isSelectRowWhenUseArrowKey) {
                    setSelectedRow(row.original);
                } else if (!!isSelectRowWhenUseArrowKey && !!row) {
                    handleRowClick(row.original, index);
                }
            } else if (e.key === "ArrowUp") {
                const row = tableData[index - 1];
                if (row && !isSelectRowWhenUseArrowKey) {
                    setSelectedRow(row.original);
                } else if (!!isSelectRowWhenUseArrowKey && !!row) {
                    handleRowClick(row.original, index);
                }
            }

            if (enableArrowFocus && e.target instanceof HTMLInputElement) {
                let key = e.key;
                if (key === "Enter") {
                    key = "ArrowDown";
                }

                const currentCell = e.target.closest("td");
                const currentRow = currentCell?.closest("tr");

                if (!currentCell || !currentRow) return;

                const allRows = Array.from(
                    currentRow.parentElement?.querySelectorAll("tr") || [],
                );
                const currentRowIndex = allRows.indexOf(currentRow);

                const allCells = Array.from(currentRow.querySelectorAll("td"));
                const currentCellIndex = allCells.indexOf(currentCell);

                if (key === "ArrowDown") {
                    const nextRow = allRows[currentRowIndex + 1];
                    if (nextRow) {
                        const nextCell = nextRow.querySelectorAll("td")[currentCellIndex];
                        const target = nextCell?.querySelector("input");
                        if (target instanceof HTMLInputElement) {
                            target.focus();
                            requestAnimationFrame(() => {
                                target.select();
                            });
                        }
                    }
                }
                if (key === "ArrowUp") {
                    const prevRow = allRows[currentRowIndex - 1];
                    if (prevRow) {
                        const prevCell = prevRow.querySelectorAll("td")[currentCellIndex];
                        const target = prevCell?.querySelector("input");
                        if (target instanceof HTMLInputElement) {
                            target.focus();
                            requestAnimationFrame(() => {
                                target.select();
                            });
                        }
                    }
                }
                if (key === "ArrowRight") {
                    const nextCell = allCells[currentCellIndex + 1];
                    const target = nextCell?.querySelector("input");
                    if (target instanceof HTMLInputElement) {
                        target.focus();
                        requestAnimationFrame(() => {
                            target.select();
                        });
                    }
                }
                if (key === "ArrowLeft") {
                    const prevCell = allCells[currentCellIndex - 1];
                    const target = prevCell?.querySelector("input");
                    if (target instanceof HTMLInputElement) {
                        target.focus();
                        requestAnimationFrame(() => {
                            target.select();
                        });
                    }
                }
            }
            if (
                enableScrollTo &&
                ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)
            ) {
                e.preventDefault();
            }
        }
    };

    useEffect(() => {
        setIsMouned(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    return (
        <>
            {isLoading && <Spinner />}
            {(enableGlobalFilter || (showCardView && enableColumnFilter)) && (
                <div className="flex items-center gap-2 mb-1 h-lg:mb-2">
                    {enableGlobalFilter && (
                        <div className="relative flex-1 min-w-0">
                            <DebouncedInput
                                type="search"
                                className="pr-6 h-lg:pr-8 w-full !ring-0 !outline-none"
                                debounce={250}
                                onChange={(value) =>
                                    table.setGlobalFilter(String(value).trim().toLocaleLowerCase())
                                }
                                value={globalFilter}
                                placeholder={placeholderSearch}
                            />
                            <MagnifyingGlassIcon className="absolute right-1 top-1 h-lg:right-2 h-lg:top-2 h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                    {showCardView && enableColumnFilter && (
                        <MobileColumnFilters table={table} />
                    )}
                </div>
            )}
            <div
                tabIndex={0}
                id={id}
                ref={tableContainerRef}
                onKeyDown={(e) => handleKeyDown(e)}
                className={`${className}`}
            >
                {showCardView ? (
                    <MobileCardList
                        table={table}
                        tableData={tableData}
                        selectedRow={selectedRow}
                        onRowClick={handleRowClick}
                        onRowDoubleClick={onRowDoubleClick}
                    />
                ) : (
                <Table className={tableClassName}>
                    <DeprecatedTableHeader
                        {...(!!tHeadClass && { className: `${tHeadClass}` })}
                    >
                        {table.getHeaderGroups().map((headerGroup) => (
                            <DeprecatedTableRow
                                key={headerGroup.id}
                                style={{ height: "1px" }}
                            >
                                {hasSubRows && (
                                    <DeprecatedTableHead
                                        key={"subRows-col-header"}
                                    ></DeprecatedTableHead>
                                )}
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <DeprecatedTableHead
                                            key={header.id}
                                            style={
                                                columnPinning
                                                    ? {
                                                        ...getCommonPinningStyles(
                                                            header.column,
                                                            "#39568f",
                                                        ),
                                                        height: "inherit",
                                                    }
                                                    : { height: "inherit" }
                                            }
                                        >
                                            <div className="flex flex-col h-full justify-between">
                                                <div className="flex-1 flex flex-col justify-center w-full">
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext(),
                                                        )}
                                                </div>
                                                {enableColumnFilter && header.column.getCanFilter() ? (
                                                    <div>
                                                        <Filter column={header.column} />
                                                    </div>
                                                ) : null}
                                            </div>
                                        </DeprecatedTableHead>
                                    );
                                })}
                            </DeprecatedTableRow>
                        ))}
                    </DeprecatedTableHeader>
                    <DeprecatedTableBody>
                        {table.getRowModel().rows?.length ? (
                            enableGrouping ? (
                                Object.keys(groupedData)
                                    .sort((a, b) => {
                                        const normalizedA = normalizeString(a);
                                        const normalizedB = normalizeString(b);
                                        const sortOrder = groupSortAscending ? 1 : -1;
                                        return sortOrder * normalizedA.localeCompare(normalizedB);
                                    })
                                    .map((groupName, groupIndex) => {
                                        const isRender = groupedData[groupName]?.some((row) => {
                                            const { originalRow } = getRowStyle(row);
                                            if (!originalRow) return;
                                            return originalRow.columnFilters &&
                                                Object.keys(originalRow.columnFilters).length
                                                ? Object.values(originalRow.columnFilters).every(
                                                    (value) => value === true,
                                                )
                                                : true;
                                        });
                                        if (!isRender) return null;

                                        const { originalRow, style } = getRowStyle(
                                            groupedData[groupName][0],
                                        );
                                        return (
                                            <Fragment key={groupName}>
                                                <DeprecatedTableRow
                                                    key={`group-${groupName}`}
                                                    className={`cursor-pointer bg-gray-200 font-bold ${groupName === selectedGroup
                                                        ? "bg-amber-200 hover:bg-amber-200/90"
                                                        : (tRowClass ?? "")
                                                        }`}
                                                    style={style}
                                                    onClick={() => {
                                                        setSelectedRow(null);
                                                        setSelectedGroup(groupName);
                                                        toggleGroup(groupName);
                                                        if (onGroupClick) onGroupClick(groupName);
                                                    }}
                                                >
                                                    <DeprecatedTableCell
                                                        key={`group-${groupName}-chevron-${groupIndex}`}
                                                        className="text-center"
                                                        colSpan={columns.length}
                                                    >
                                                        <div className="flex items-center">
                                                            {expandedGroups[groupName] ? (
                                                                <ChevronDownIcon className="mr-2" />
                                                            ) : (
                                                                <ChevronRightIcon className="mr-2" />
                                                            )}
                                                            {groupName}
                                                        </div>
                                                    </DeprecatedTableCell>
                                                </DeprecatedTableRow>
                                                {expandedGroups[groupName] &&
                                                    groupedData[groupName].map((row, index) => {
                                                        const { originalRow, style } = getRowStyle(row);
                                                        if (!originalRow) return;
                                                        const isRender =
                                                            originalRow.columnFilters &&
                                                                Object.keys(originalRow.columnFilters).length
                                                                ? Object.values(
                                                                    originalRow.columnFilters,
                                                                ).every((value) => value === true)
                                                                : true;

                                                        if (!isRender) return null;

                                                        return (
                                                            <DeprecatedTableRow
                                                                key={`group-${groupName}-groupedData-${index}`}
                                                                ref={
                                                                    index === indexScrollTo
                                                                        ? rowScrollToRef
                                                                        : null
                                                                }
                                                                className={
                                                                    row === selectedRow
                                                                        ? "bg-amber-200 hover:bg-amber-200/90"
                                                                        : ""
                                                                }
                                                                style={style}
                                                                onClick={() =>
                                                                    handleRowClick(originalRow.original, index)
                                                                }
                                                            >
                                                                {isRender &&
                                                                    originalRow.getVisibleCells().map((cell) => (
                                                                        <DeprecatedTableCell
                                                                            className={cn(
                                                                                "text-center",
                                                                                cell.column.columnDef.meta?.className,
                                                                            )}
                                                                            key={`group-${groupName}-groupedData-${index}-${cell.id}`}
                                                                        >
                                                                            {typeof cell.column.columnDef.cell ===
                                                                                "string"
                                                                                ? cell.column.columnDef.cell
                                                                                : cell.column.columnDef.cell?.(
                                                                                    cell.getContext(),
                                                                                )}
                                                                        </DeprecatedTableCell>
                                                                    ))}
                                                            </DeprecatedTableRow>
                                                        );
                                                    })}
                                                {expandedGroups[groupName] && enableGroupFooter && (
                                                    <DeprecatedTableRow
                                                        key={`group-footer-${groupName}`}
                                                        className={"bg-muted"}
                                                    >
                                                        {originalRow?.getVisibleCells().map((cell) => {
                                                            const {
                                                                showGroupFooter,
                                                                groupFooterValue,
                                                                groupFooterFn,
                                                            } = cell.column.columnDef.meta ?? {};

                                                            return (
                                                                <DeprecatedTableCell
                                                                    className="text-right p-1"
                                                                    key={`group-footer-${groupName}-${cell.id}`}
                                                                >
                                                                    <div
                                                                        className={
                                                                            showGroupFooter
                                                                                ? "bg-white text-sm p-1"
                                                                                : ""
                                                                        }
                                                                    >
                                                                        {showGroupFooter && groupFooterValue
                                                                            ? groupFooterValue
                                                                            : groupFooterFn
                                                                                ? groupFooterFn(originalRow.original)
                                                                                : null}
                                                                    </div>
                                                                </DeprecatedTableCell>
                                                            );
                                                        })}
                                                    </DeprecatedTableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })
                            ) : (
                                tableData.map((row, index) => {
                                    const isRender =
                                        row.columnFilters && Object.keys(row.columnFilters).length
                                            ? Object.values(row.columnFilters).every(
                                                (value) => value === true,
                                            )
                                            : true;
                                    const style = getRowColor ? getRowColor(row.original) : {};
                                    const className = cn(
                                        row.original === selectedRow
                                            ? [
                                                "bg-amber-200 hover:bg-amber-200/90 cursor-pointer",
                                                selectRowClass,
                                            ]
                                            : (tRowClass ?? "cursor-pointer"),
                                        getRowClassName?.(row.original, index),
                                    );
                                    return (
                                        <Fragment key={`non-group-fragment-${row.id}`}>
                                            <DeprecatedTableRow
                                                key={`non-group-${row.id}`}
                                                ref={
                                                    typeof indexScrollTo === "number" &&
                                                        row.original === data[indexScrollTo]
                                                        ? (el) => {
                                                            rowScrollToRef.current = el;
                                                        }
                                                        : null
                                                }
                                                className={className}
                                                style={style}
                                                data-state={
                                                    row.getIsSelected() ? "selected" : undefined
                                                }
                                                onClick={() => handleRowClick(row.original, index)}
                                                onDoubleClick={() =>
                                                    onRowDoubleClick?.(row.original, index)
                                                }
                                            >
                                                {hasSubRows && (
                                                    <DeprecatedTableCell
                                                        key={`non-group-${row.id}-viewSubRows-${row.id}`}
                                                        className="text-center"
                                                        onClick={() => handleViewSubRows(row.original)}
                                                    >
                                                        <div className="flex items-center">
                                                            <SquareArrowOutUpRight width={15} height={15} />
                                                        </div>
                                                    </DeprecatedTableCell>
                                                )}
                                                {isRender &&
                                                    row.getVisibleCells().map((cell) =>
                                                        cell.column.id === "tableRowIndex" ? (
                                                            <DeprecatedTableCell
                                                                key={`non-group-${row.id}-cell-${cell.id}`}
                                                                className={
                                                                    cell.column.columnDef.meta?.className
                                                                }
                                                                style={
                                                                    columnPinning
                                                                        ? {
                                                                            ...getCommonPinningStyles(
                                                                                cell.column,
                                                                                selectedRow === row.original
                                                                                    ? "#fde68a"
                                                                                    : "#fff",
                                                                            ),
                                                                        }
                                                                        : undefined
                                                                }
                                                            >
                                                                {index + 1}
                                                            </DeprecatedTableCell>
                                                        ) : (
                                                            <DeprecatedTableCell
                                                                key={`non-group-${row.id}-cell-${cell.id}`}
                                                                className={
                                                                    cell.column.columnDef.meta?.className
                                                                }
                                                                style={
                                                                    columnPinning
                                                                        ? {
                                                                            ...getCommonPinningStyles(
                                                                                cell.column,
                                                                                selectedRow === row.original
                                                                                    ? "#fde68a"
                                                                                    : "#fff",
                                                                            ),
                                                                        }
                                                                        : undefined
                                                                }
                                                            >
                                                                {flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext(),
                                                                )}
                                                            </DeprecatedTableCell>
                                                        ),
                                                    )}
                                            </DeprecatedTableRow>
                                        </Fragment>
                                    );
                                })
                            )
                        ) : (
                            <></>
                        )}
                    </DeprecatedTableBody>
                    {enableFooter &&
                        table
                            .getFooterGroups()
                            .some((footerGroup) =>
                                footerGroup.headers.some(
                                    (footer) => footer.column.columnDef.footer,
                                ),
                            ) && (
                            <DeprecatedTableFooter className="sticky bottom-0 z-10">
                                {table.getFooterGroups().map((footerGroup) => (
                                    <DeprecatedTableRow key={`table-footer-${footerGroup.id}`}>
                                        {footerGroup.headers.map((footer) => (
                                            <DeprecatedTableCell
                                                className="p-1"
                                                style={
                                                    columnPinning
                                                        ? {
                                                            ...getCommonPinningStyles(
                                                                footer.column,
                                                                "#f1f5f9",
                                                            ),
                                                            height: "inherit",
                                                        }
                                                        : { height: "inherit" }
                                                }
                                                key={`table-footer-cell-${footer.id}`}
                                            >
                                                {footer.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        footer.column.columnDef.footer,
                                                        footer.getContext(),
                                                    )}
                                            </DeprecatedTableCell>
                                        ))}
                                    </DeprecatedTableRow>
                                ))}
                            </DeprecatedTableFooter>
                        )}
                </Table>
                )}
            </div>
            {enablePaging && (
                <DataTablePagination
                    table={table}
                    enableToggleColumn={enableToggleColumn}
                    viewOptionsContentClassName={viewOptionsContentClassName}
                />
            )}
        </>
    );
}

/**
 * Danh sách dạng thẻ hiển thị khi màn hình hẹp (mục 48.1 spec) — thay cho <Table>, không cài riêng
 * từng trang. Nhãn mỗi dòng lấy trực tiếp từ header đã khai báo của cột (flexRender lại) nhưng ẩn
 * icon sort/nút lọc bên trong (dùng pointer-events-none + ẩn svg) — hiện nguyên trong thẻ sẽ gây rối
 * vì sắp xếp/lọc theo từng dòng trong thẻ không có ý nghĩa (đã có "Bộ lọc" riêng cho mobile).
 * Cột "actions" ghim góc trên-phải (thu nhỏ nút cho vừa thẻ), cột "index" (STT) ẩn vì không có ý
 * nghĩa khi xem dạng thẻ.
 */
function MobileCardList<TData>({
    table,
    tableData,
    selectedRow,
    onRowClick,
    onRowDoubleClick,
}: {
    table: ReactTable<TData>;
    tableData: Row<TData>[];
    selectedRow: TData | null;
    onRowClick: (row: TData, index: number) => void;
    onRowDoubleClick?: (row: TData, index: number) => void;
}) {
    const headers = table.getHeaderGroups()[0]?.headers ?? [];

    if (tableData.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 p-2">
            {tableData.map((row, index) => {
                const cells = row.getVisibleCells();
                const actionsCell = cells.find((c) => c.column.id === "actions");
                const fieldCells = cells.filter(
                    (c) => c.column.id !== "actions" && c.column.id !== "index",
                );
                const isSelected = row.original === selectedRow;

                return (
                    <div
                        key={row.id}
                        className={cn(
                            "rounded-xl border flex flex-col cursor-pointer shadow-xs transition-colors overflow-hidden",
                            isSelected
                                ? "bg-amber-100 border-amber-300 hover:bg-amber-100/80"
                                : "bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-white/[0.04]",
                        )}
                        onClick={() => onRowClick(row.original, index)}
                        onDoubleClick={() => onRowDoubleClick?.(row.original, index)}
                    >
                        {actionsCell && (
                            <div
                                className="flex justify-end border-b border-gray-100 px-2 py-1 dark:border-gray-800 [&_button]:h-6 [&_button]:min-w-6 [&_button]:px-1.5 [&_button]:py-0 [&_button]:text-xs"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {flexRender(
                                    actionsCell.column.columnDef.cell,
                                    actionsCell.getContext(),
                                )}
                            </div>
                        )}
                        <div className="flex flex-col px-3 py-1">
                            {fieldCells.map((cell) => {
                                const header = headers.find((h) => h.column.id === cell.column.id);
                                return (
                                    <div
                                        key={cell.id}
                                        className="flex items-start justify-between gap-3 py-1 leading-tight"
                                    >
                                        <span className="pointer-events-none inline-flex items-center gap-0.5 text-[11px] font-bold text-gray-900 shrink-0 [&_svg]:hidden [&_span]:normal-case! [&_button]:text-[11px]! [&_button]:font-bold! dark:text-white">
                                            {header && !header.isPlaceholder
                                                ? flexRender(header.column.columnDef.header, header.getContext())
                                                : cell.column.id}
                                            <span>:</span>
                                        </span>
                                        <span
                                            className={cn(
                                                "flex-1 min-w-0 text-[12px] line-clamp-2 text-gray-700 dark:text-gray-200",
                                                // Nhiều cột tự khai báo sẵn class truncate/whitespace-nowrap (dùng cho
                                                // bảng desktop, 1 dòng) trên chính nội dung cell — ép ghi đè để chữ
                                                // được xuống dòng bình thường thì line-clamp-2 ở trên mới có tác dụng.
                                                "**:whitespace-normal! **:overflow-visible! **:text-clip!",
                                                // Cột trạng thái (badge) — id này dùng nhất quán ở mọi trang — canh phải
                                                // đẹp hơn thay vì canh trái như các field văn bản thường.
                                                cell.column.id === "status" ? "text-right" : "text-left",
                                            )}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Bộ lọc theo cột dạng popover cho mobile (mục 48.1) — tái dùng nguyên component Filter đã có,
 * chỉ đổi chỗ hiển thị (từ dưới mỗi tiêu đề cột sang xếp dọc trong 1 popover) để không mất khả năng
 * lọc khi chuyển sang dạng thẻ.
 */
function MobileColumnFilters<TData>({ table }: { table: ReactTable<TData> }) {
    const [open, setOpen] = useState(false);
    const headers = (table.getHeaderGroups()[0]?.headers ?? []).filter((h) =>
        h.column.getCanFilter(),
    );

    if (headers.length === 0) return null;

    const activeCount = headers.filter((h) => {
        const v = h.column.getFilterValue();
        return v !== undefined && v !== "" && v !== null;
    }).length;

    return (
        <div className="shrink-0">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="flex items-center gap-1.5">
                        <FilterIcon className="h-3.5 w-3.5" />
                        Bộ lọc
                        {activeCount > 0 && (
                            <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">
                                {activeCount}
                            </span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto flex flex-col gap-3 z-120">
                    {headers.map((header) => (
                        <div key={header.id} className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">
                                {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                            <Filter column={header.column} />
                        </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => table.resetColumnFilters()}>
                        Xóa bộ lọc
                    </Button>
                </PopoverContent>
            </Popover>
        </div>
    );
}

interface DataTableColumnHeaderProps<TData, TValue>
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    column: Column<TData, TValue>;
    title: React.ReactNode;
}

export function DataTableColumnHeaderSort<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    const { filterVariant, enableColumnFilterDropdown } =
        column.columnDef.meta ?? {};
    const [open, setOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);

    // TODO: bug something here related to can't call getFacetedUniqueValues
    // when using column.getFacetedUniqueValues() in useMemo
    const sortedUniqueValues = useMemo(
        () =>
            enableColumnFilterDropdown && filterVariant !== "range"
                ? Array.from(column?.getFacetedUniqueValues()?.keys() ?? []).sort()
                : [],
        [column, filterVariant, enableColumnFilterDropdown],
    );

    if (!column.getCanSort()) {
        return (
            <div
                className={cn("uppercase whitespace-nowrap text-headline-2", className)}
            >
                {title}
            </div>
        );
    }

    return (
        <div className={cn("flex flex-row group w-full", className)}>
            <button
                className="flex items-center text-headline-2 w-full"
                onClick={() => column.toggleSorting()}
                type="button"
            >
                <span className="uppercase whitespace-nowrap">{title}</span>
                {column.getIsSorted() === "desc" ? (
                    <CaretDownIcon className="ml-1 h-4 w-4" />
                ) : column.getIsSorted() === "asc" ? (
                    <CaretUpIcon className="ml-1 h-4 w-4" />
                ) : (
                    <CaretSortIcon className="ml-1 h-4 w-4" />
                )}
            </button>
            {filterVariant !== "range" && enableColumnFilterDropdown && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="link"
                            className="flex items-center justify-center text-white p-1 relative"
                            onClick={() => setOpen((prev) => !prev)}
                        >
                            <FilterIcon size={12} />
                            {Boolean(
                                column.getFilterValue() as string | number | boolean,
                            ) && (
                                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                                )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-70 max-w-[calc(100vw-2rem)] p-2 z-120">
                        <div className="max-h-60 overflow-auto">
                            {isFiltering && (
                                <div
                                    key="Tất cả"
                                    className="text-body-3 p-1 hover:bg-light-blue cursor-pointer"
                                    onClick={() => {
                                        column.setFilterValue("");
                                        setOpen(false);
                                        setIsFiltering(false);
                                    }}
                                >
                                    (Tất cả)
                                </div>
                            )}
                            {sortedUniqueValues?.map((value: any) => (
                                <div
                                    key={value}
                                    className="text-body-3 p-1 hover:bg-light-blue cursor-pointer"
                                    onClick={() => {
                                        column.setFilterValue(value);
                                        setOpen(false);
                                        setIsFiltering(true);
                                    }}
                                >
                                    {value}
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}

interface DataTablePaginationProps<TData> {
    table: ReactTable<TData>;
    enableToggleColumn: boolean;
    viewOptionsContentClassName?: string;
}

function DataTablePagination<TData>({
    table,
    enableToggleColumn,
    viewOptionsContentClassName,
}: DataTablePaginationProps<TData>) {
    const isMobile = useIsMobile();
    const navButtonClass = isMobile ? "h-6 w-6" : undefined;
    const navIconClass = isMobile ? "h-3 w-3" : "h-4 w-4";
    return (
        <div className={cn("flex flex-wrap items-center justify-end p-2", isMobile ? "gap-x-2 gap-y-1.5" : "gap-x-6 gap-y-2 lg:gap-x-8")}>
            <div className={cn("flex flex-wrap items-center", isMobile ? "gap-1.5" : "gap-2")}>
                {enableToggleColumn && (
                    <DataTableViewOptions
                        table={table}
                        viewOptionsContentClassName={viewOptionsContentClassName}
                    />
                )}
                {!isMobile && <p className="text-xs font-medium">Số dòng mỗi trang</p>}
                <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onChange={(value) => {
                        table.setPageSize(Number(value));
                    }}
                    options={[50, 100, 150, 200].map((pageSize) => ({
                        value: `${pageSize}`,
                        label: `${pageSize}`,
                    }))}
                    showSearch={false}
                    className={isMobile ? "min-w-12" : "min-w-14"}
                />
            </div>
            <div className={cn("flex items-center justify-center text-xs font-medium", !isMobile && "w-20")}>
                {isMobile
                    ? `Trang ${table.getState().pagination.pageIndex + 1}/${table.getPageCount()}`
                    : `Trang ${table.getState().pagination.pageIndex + 1} trên ${table.getPageCount()}`}
            </div>
            <div className={cn("flex items-center", isMobile ? "gap-1" : "space-x-2")}>
                <Button
                    variant="outline"
                    size="icon"
                    className={navButtonClass}
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                >
                    <span className="sr-only">Trang đầu</span>
                    <DoubleArrowLeftIcon className={navIconClass} />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className={navButtonClass}
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    <span className="sr-only">Trang trước</span>
                    <ChevronLeftIcon className={navIconClass} />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className={navButtonClass}
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    <span className="sr-only">Trang sau</span>
                    <ChevronRightIcon className={navIconClass} />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className={navButtonClass}
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                >
                    <span className="sr-only">Trang cuối</span>
                    <DoubleArrowRightIcon className={navIconClass} />
                </Button>
            </div>
        </div>
    );
}

interface DataTableViewOptionsProps<TData> {
    table: ReactTable<TData>;
    viewOptionsContentClassName?: string;
}

function DataTableViewOptions<TData>({
    table,
    viewOptionsContentClassName,
}: DataTableViewOptionsProps<TData>) {
    const isMobile = useIsMobile();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size={isMobile ? "icon" : "default"} aria-label="Ẩn/hiện cột">
                    <MixerHorizontalIcon className={cn("h-4 w-4", !isMobile && "mr-2")} />
                    {!isMobile && "Ẩn/hiện cột"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className={cn(
                    "w-auto min-w-[150px]",
                    viewOptionsContentClassName ?? "z-120",
                )}
            >
                <DropdownMenuLabel>Ẩn/hiện cột</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                    .getAllColumns()
                    .filter(
                        (column) =>
                            typeof column.accessorFn !== "undefined" && column.getCanHide(),
                    )
                    .map((column) => {
                        return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                            >
                                {column.columnDef.meta?.titleToggleColumn ? (
                                    <span>{column.columnDef.meta?.titleToggleColumn}</span>
                                ) : (
                                    <span className="capitalize">{column.id}</span>
                                )}
                            </DropdownMenuCheckboxItem>
                        );
                    })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Filter({ column }: { column: Column<any, unknown> }) {
    const columnFilterValue = column.getFilterValue();
    const { filterVariant } = column.columnDef.meta ?? {};

    // Cột trạng thái (id nhất quán ở mọi trang) hiển thị badge dịch tiếng Việt — lọc bằng text tự
    // gõ không khớp được với giá trị gốc ("ACTIVE"...). Đổi sang dropdown chọn đúng theo tình trạng
    // thực có trong dữ liệu, hiện đúng nhãn tiếng Việt.
    if (column.id === "status") {
        const rawValues = Array.from(column.getFacetedUniqueValues()?.keys() ?? []) as string[];
        const options = [
            { value: "", label: "(Tất cả)" },
            ...rawValues.map((value) => ({ value, label: STATUS_FILTER_LABELS[value] ?? value })),
        ];
        return (
            <Select
                options={options}
                value={(columnFilterValue as string) ?? ""}
                onChange={(value) => column.setFilterValue(value || undefined)}
                placeholder="Chọn trạng thái"
                showSearch={false}
                className="w-full"
                classNamePopover="w-auto"
            />
        );
    }

    if (
        filterVariant === "range" ||
        column.columnDef.filterFn === "inNumberRange"
    ) {
        return (
            <div>
                <div className="flex space-x-2">
                    <DebouncedInput
                        type="number"
                        value={(columnFilterValue as [number, number])?.[0] ?? ""}
                        onChange={(value) =>
                            column.setFilterValue((old: [number, number]) => [
                                value,
                                old?.[1],
                            ])
                        }
                        className="max-w-24 border shadow rounded"
                    />
                    <DebouncedInput
                        type="number"
                        value={(columnFilterValue as [number, number])?.[1] ?? ""}
                        onChange={(value) =>
                            column.setFilterValue((old: [number, number]) => [
                                old?.[0],
                                value,
                            ])
                        }
                        className="max-w-24 border shadow rounded"
                    />
                </div>
                <div className="h-1" />
            </div>
        );
    }

    if (column.columnDef.filterFn === "isBoolean") {
        return (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={!!columnFilterValue}
                    onCheckedChange={(value: boolean) =>
                        column.setFilterValue(value ? true : false)
                    }
                    className="bg-white border-white"
                />
            </div>
        );
    }

    return (
        <DebouncedInput
            className="max-w-full"
            onChange={(value) => column.setFilterValue(value)}
            type="text"
            value={columnFilterValue as string}
        />
    );
}

function DebouncedInput({
    value: initialValue,
    onChange,
    debounce = 500,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    size: _,
    ...props
}: {
    value: string | number;
    onChange: (value: string | number) => void;
    debounce?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
    const [value, setValue] = useState<string | number>(initialValue ?? "");

    useEffect(() => {
        setValue(initialValue ?? "");
    }, [initialValue]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            onChange(value);
        }, debounce);

        return () => clearTimeout(timeout);
        // TODO(https://rm.vnvc.info/issues/92105): Fix and remove disable comment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <Input
            {...props}
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
    );
}

interface InputCellProps<TData, TValue> {
    getValue: Getter<TValue>;
    rowIndex: number;
    columnId: string;
    table: ReactTable<TData>;
    disabled?: boolean;
    className?: string;
}

export const InputCell = <TData, TValue>({
    getValue,
    rowIndex,
    columnId,
    table,
    disabled,
    className,
}: InputCellProps<TData, TValue>) => {
    const initialValue = getValue();
    const [value, setValue] = useState(() =>
        initialValue == null ? "" : String(initialValue),
    );

    const onBlur = () => {
        table.options.meta?.updateData(rowIndex, columnId, value);
    };

    useEffect(() => {
        setValue(initialValue == null ? "" : String(initialValue));
    }, [initialValue]);

    return (
        <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            className={className}
        />
    );
};

interface TextareaCellProps<TData, TValue> {
    getValue: Getter<TValue>;
    rowIndex: number;
    columnId: string;
    table: ReactTable<TData>;
    disabled?: boolean;
    className?: string;
}

export const TextareaCell = <TData, TValue>({
    getValue,
    rowIndex,
    columnId,
    table,
    disabled,
    className,
}: TextareaCellProps<TData, TValue>) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue as string);

    const onBlur = () => {
        table.options.meta?.updateData(rowIndex, columnId, value);
    };

    useEffect(() => {
        setValue(initialValue as string);
    }, [initialValue]);

    return (
        <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            className={className}
        />
    );
};

interface CheckboxCellProps<TData, TValue> {
    getValue: Getter<TValue>;
    rowIndex: number;
    columnId: string;
    table: ReactTable<TData>;
    disabled?: boolean;
}

export const CheckboxCell = <TData, TValue>({
    getValue,
    rowIndex,
    columnId,
    table,
    disabled,
}: CheckboxCellProps<TData, TValue>) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue as boolean);

    useEffect(() => {
        setValue(initialValue as boolean);
    }, [initialValue]);

    return (
        <Checkbox
            disabled={disabled}
            checked={value}
            onCheckedChange={(value: boolean) => {
                setValue(value);
                table.options.meta?.updateData(rowIndex, columnId, value);
            }}
        />
    );
};
