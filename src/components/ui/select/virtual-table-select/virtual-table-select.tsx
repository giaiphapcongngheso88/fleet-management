"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useMemo, useRef, useState } from "react";

import { ColumnDef } from "@tanstack/react-table";
import { cva, VariantProps } from "class-variance-authority";
import _ from "lodash";
import { VirtualDataTable } from "./virtual-data-table";

const selectVariants = cva(
    "min-w-32 justify-between gap-2 border-stroke-90 text-dark-sky bg-white hover:bg-white disabled:bg-light-blue",
    {
        variants: {
            size: {
                default: ["h-5.5 px-2.5 pr-1", "h-lg:h-8 h-lg:pr-2"],
                sm: "pr-1",
                md: "pr-2",
                lg: "pr-3",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

interface VirtualTableSelectProps<TData, TValue>
    extends Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        "onChange" | "value"
    >,
    VariantProps<typeof selectVariants> {
    className?: string;
    classNamePopover?: string;
    classNameTable?: string;
    disabled?: boolean;
    placeholder?: string;
    placeholderSearch?: string;
    showSearch?: boolean;
    onChange?: (value: TData) => void;
    value?: TData | null;
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    labelKey: keyof TData;
    valueKey: keyof TData;
    columnPinning?: string[];
    alignPopover?: "start" | "end" | "center";
    onSelectRow?: (row: TData) => void;
}

export function VirtualTableSelect<TData, TValue>({
    className,
    classNamePopover,
    classNameTable,
    placeholder,
    placeholderSearch,
    size,
    showSearch = true,
    onChange,
    disabled,
    value: originalValue,
    data,
    columns,
    labelKey,
    valueKey,
    columnPinning,
    alignPopover = "end",
    onSelectRow,
    ...rest
}: VirtualTableSelectProps<TData, TValue>) {
    const [open, setOpen] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const dataTableRef = useRef<TData[]>(data);
    const [highlightedState, setHighlightedState] = useState<{
        value: TData | null;
        index: number | undefined;
    }>({
        value: null,
        index: undefined,
    });

    const setHighlightedValue = (value: TData | null) => {
        setHighlightedState({
            value,
            index: dataTableRef.current?.findIndex(
                (item) => item[valueKey] === value?.[valueKey],
            ),
        });
    };

    useEffect(() => {
        const keys = Object.keys(rowSelection);
        if (keys[0] && Number(keys[0]) >= 0) {
            const value = dataTableRef.current[Number(keys[0])];
            if (value) {
                setHighlightedState({
                    value,
                    index: Number(keys[0]),
                });
                if (onChange && originalValue !== value) {
                    onChange(value);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowSelection]);

    useEffect(() => {
        setHighlightedValue(
            data.find((item) => item[valueKey] === originalValue?.[valueKey]) || null,
        );
        dataTableRef.current = data;
        // TODO(https://rm.vnvc.info/issues/92105): Fix and remove disable comment
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, originalValue, valueKey]);

    const handleSelect = (row: TData) => {
        setOpen(false);
        if (onChange && originalValue !== row) {
            onChange(row);
            return;
        }
        setHighlightedValue(row);
    };

    const selectedLabel = useMemo(() => {
        return originalValue ? ((originalValue[labelKey] || "") as string) : "";
    }, [originalValue, labelKey]);

    useEffect(() => {
        if (_.isEmpty(selectedLabel)) {
            setRowSelection({});
        }
    }, [selectedLabel]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (data.length === 0) return;
        if (e.key === "Enter" && highlightedState.value) {
            if (onSelectRow) onSelectRow(highlightedState.value);
            handleSelect(highlightedState.value);
            return;
        }
        if (!dataTableRef.current || dataTableRef.current.length === 0) return;
        const dataTable = dataTableRef.current;
        const index = dataTable.findIndex(
            (item) => item[valueKey] === highlightedState.value?.[valueKey],
        );
        if (e.key === "ArrowDown") {
            if (index === -1) {
                setRowSelection({ "0": true });
                return;
            }
            if (index === dataTable.length - 1) {
                return;
            }
            setRowSelection({ [`${index + 1}`]: true });
        } else if (e.key === "ArrowUp") {
            if (index === -1) {
                setRowSelection({ [`${dataTable.length - 1}`]: true });
                return;
            }
            if (index === 0) {
                return;
            }
            setRowSelection({ [`${index - 1}`]: true });
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    onKeyDown={(e) => {
                        if (/^[a-zA-Z0-9]$/.test(e.key) && open === false) setOpen(true);
                    }}
                    {...rest}
                    variant="outline"
                    aria-expanded={open}
                    className={cn(selectVariants({ size }), className)}
                    title={selectedLabel}
                    disabled={disabled}
                >
                    {originalValue ? (
                        <span className="overflow-hidden text-ellipsis flex-1 text-left">
                            {selectedLabel}
                        </span>
                    ) : (
                        placeholder || "Select item..."
                    )}
                    <ChevronDown className="h-3 w-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align={alignPopover}
                className={cn("min-w-42 p-1.5", classNamePopover)}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                <VirtualDataTable
                    className={cn("bg-white flex-1", classNameTable)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    columns={columns as any}
                    data={data}
                    height={`${80 * 4}px`}
                    enableGlobalFilter={showSearch}
                    placeholderSearch={placeholderSearch}
                    enableMultiRowSelection={false}
                    rowSelection={rowSelection}
                    columnPinning={columnPinning}
                    onRowSelectionChange={(rowSelection) => {
                        setRowSelection(rowSelection);
                        setOpen(false);
                    }}
                    onSelectRow={onSelectRow}
                />
            </PopoverContent>
        </Popover>
    );
}
