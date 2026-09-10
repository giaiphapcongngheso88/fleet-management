"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useMemo, useState } from "react";
import _ from 'lodash';

import { cva, VariantProps } from "class-variance-authority";
import SelectList, { SelectOption } from "./select-list";

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

interface MultiSelectProps
    extends Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        "onChange" | "value"
    >,
    VariantProps<typeof selectVariants> {
    className?: string;
    classNamePopover?: string;
    disabled?: boolean;
    placeholder?: string;
    placeholderSearch?: string;
    noResult?: string;
    options: SelectOption[];
    showSearch?: boolean;
    onChange?: (value: string[]) => void;
    value?: string[];
}

export function MultiSelect({
    className,
    classNamePopover,
    placeholder,
    placeholderSearch,
    noResult,
    size,
    options,
    showSearch = true,
    onChange,
    disabled,
    value: originalValue,
    ...rest
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState<string[]>(originalValue || []);
    const allOptionValues = useMemo(
        () => options.map((opt) => opt.value),
        [options],
    );
    const [selectAll, setSelectAll] = useState<boolean>(
        allOptionValues.every((opt) => originalValue?.includes(opt)),
    );
    useEffect(() => {
        setValue(originalValue || []);
    }, [originalValue]);

    useEffect(() => {
        setSelectAll(allOptionValues.every((opt) => value.includes(opt)));
    }, [options, value, allOptionValues]);

    const handleOpenChange = (open: boolean) => {
        setOpen(open);
        if (!open && onChange && !_.isEqual(value, originalValue)) {
            onChange(value);
        }
    };
    const handleSelect = (selectedValue: string) => {
        const newValue = value.includes(selectedValue)
            ? value.filter((v) => v !== selectedValue)
            : [...value, selectedValue];
        const isSelectedAll = allOptionValues.every((opt) =>
            newValue?.includes(opt),
        );
        setSelectAll(isSelectedAll);
        setValue(newValue);
    };

    const selectedLabel = useMemo(() => {
        return value
            .map((val) => options.find((item) => item.value === val)?.label)
            .join(", ");
    }, [value, options]);

    const onSelectChange = (newValue: boolean) => {
        setSelectAll(newValue);
        if (newValue) {
            setValue(allOptionValues);
        } else {
            setValue([]);
        }
    };
    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    {...rest}
                    variant="outline"
                    aria-expanded={open}
                    className={cn(selectVariants({ size }), className)}
                    title={selectedLabel}
                    disabled={disabled}
                >
                    {value.length > 0 ? (
                        <span className="truncate flex-1 text-left">{selectedLabel}</span>
                    ) : (
                        placeholder || "Select item..."
                    )}
                    <ChevronDown className="h-3 w-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className={cn("min-w-44 p-1.5", classNamePopover)}
            >
                <SelectList
                    onSelect={handleSelect}
                    options={options}
                    selectedValue={value}
                    placeholder={placeholderSearch}
                    showSearch={showSearch}
                    multiple
                    noResult={noResult}
                    selectAllEnabled={true}
                    selectAllValue={selectAll}
                    onSelectAllChange={onSelectChange}
                />
            </PopoverContent>
        </Popover>
    );
}
