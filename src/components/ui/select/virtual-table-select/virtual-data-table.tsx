"use client";

import { cn } from "@/app/lib/utils";
import {
    DeprecatedTableCell,
    DeprecatedTableHead,
    DeprecatedTableRow,
} from "@/components/ui/deprecated_table";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
    Column,
    ColumnDef,
    OnChangeFn,
    Row,
    RowData,
    RowSelectionState,
    SortingState,
    TableOptions,
    filterFns,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import {
    CSSProperties,
    HTMLAttributes,
    forwardRef,
    useEffect,
    useRef,
    useState,
} from "react";
import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";

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

const TableComponent = forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
    />
));
TableComponent.displayName = "TableComponent";

const getCommonPinningStyles = <TData,>(
    column: Column<TData>,
): CSSProperties => {
    const isPinned = column.getIsPinned();
    const isLastLeftPinnedColumn =
        isPinned === "left" && column.getIsLastColumn("left");
    return {
        boxShadow: isLastLeftPinnedColumn
            ? "-4px 0 4px -4px gray inset"
            : undefined,
        left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
        position: isPinned ? "sticky" : undefined,
        width: column.getSize(),
        zIndex: isPinned ? 1 : 0,
    };
};

const TableRowComponent = <TData,>(
    rows: Row<TData>[],
    onSelectRow?: (row: TData) => void,
) =>
    function getTableRow(props: HTMLAttributes<HTMLTableRowElement>) {
        // @ts-expect-error data-index is a valid attribute
        const index = props["data-index"];
        const row = rows[index];

        if (!row) return null;

        const handleSelect = () => {
            row.toggleSelected();
            onSelectRow?.(row.original);
        };

        return (
            <DeprecatedTableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : null}
                onClick={handleSelect}
                className="group"
                {...props}
            >
                {row.getVisibleCells().map((cell) => (
                    <DeprecatedTableCell
                        key={cell.id}
                        style={{ ...getCommonPinningStyles(cell.column) }}
                        className="bg-white border-b group-hover:bg-amber-200/100 group-data-[state=selected]:bg-amber-200"
                    >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </DeprecatedTableCell>
                ))}
            </DeprecatedTableRow>
        );
    };

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
    const [value, setValue] = useState(initialValue);

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

interface VirtualDataTableProps<TData, TValue> {
    className?: string;
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    height: string;
    enableMultiRowSelection?: boolean;
    enableGlobalFilter?: boolean;
    placeholderSearch?: string;
    rowSelection?: RowSelectionState;
    columnPinning?: string[];
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    onSelectRow?: (row: TData) => void;
}

export function VirtualDataTable<TData, TValue>({
    className,
    columns,
    data,
    height,
    enableMultiRowSelection,
    enableGlobalFilter,
    placeholderSearch,
    rowSelection,
    columnPinning,
    onRowSelectionChange,
    onSelectRow,
}: VirtualDataTableProps<TData, TValue>) {
    const virtualRef = useRef<TableVirtuosoHandle>(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState<string>("");
    const tableOptions: TableOptions<TData> = {
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection,
            columnPinning: columnPinning
                ? {
                    left: columnPinning,
                }
                : {},
        },
        filterFns: {
            ...filterFns,
            isBoolean: (row, columnId, value) =>
                Boolean(row.getValue(columnId)) === value,
        },
        enableMultiRowSelection,
        onRowSelectionChange,
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    };
    const table = useReactTable(tableOptions);

    const { rows } = table.getRowModel();

    useEffect(() => {
        if (rowSelection) {
            const keys = Object.keys(rowSelection);
            if (keys[0] && Number(keys[0])) {
                virtualRef.current?.scrollToIndex({
                    index: Number(keys[0]),
                    align: "center",
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={cn("rounded-md", className)}>
            {enableGlobalFilter && (
                <div className="relative mb-1 h-lg:mb-2">
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
            <TableVirtuoso
                ref={virtualRef}
                style={{ height }}
                totalCount={rows.length}
                components={{
                    Table: ({ style, ...props }) => (
                        <TableComponent
                            {...props}
                            className="table-fixed border border-separate border-spacing-0"
                            style={style}
                        />
                    ),
                    TableRow: TableRowComponent(rows, onSelectRow),
                }}
                fixedHeaderContent={() =>
                    table.getHeaderGroups().map((headerGroup) => (
                        <DeprecatedTableRow
                            className="bg-card hover:bg-muted"
                            key={headerGroup.id}
                        >
                            {headerGroup.headers.map((header) => {
                                return (
                                    <DeprecatedTableHead
                                        key={header.id}
                                        colSpan={header.colSpan}
                                        style={{
                                            ...getCommonPinningStyles(header.column),
                                        }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                className="flex items-center"
                                                {...{
                                                    style: header.column.getCanSort()
                                                        ? {
                                                            cursor: "pointer",
                                                            userSelect: "none",
                                                        }
                                                        : {},
                                                    onClick: header.column.getToggleSortingHandler(),
                                                }}
                                            >
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                            </div>
                                        )}
                                    </DeprecatedTableHead>
                                );
                            })}
                        </DeprecatedTableRow>
                    ))
                }
            />
        </div>
    );
}
