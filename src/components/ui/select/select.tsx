"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useState } from "react";


import { cva, VariantProps } from "class-variance-authority";
import SelectList, { SelectOption } from "./select-list";

const selectVariants = cva(
    "min-w-32 justify-between gap-2 border-stroke-90 text-dark-sky bg-white hover:bg-white disabled:bg-light-blue",
    {
        variants: {
            size: {
                default: ["h-5.5 px-2.5 pr-1", "h-lg:h-8 h-lg:pr-2"],
                sm: "pr-1",
                md: "pr-2 h-8 w-8",
                lg: "pr-3 h-9.5 w-9.5",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

interface SelectProps
    extends Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        "onChange" | "value"
    >,
    VariantProps<typeof selectVariants> {
    value?: string;
    className?: string;
    classNamePopover?: string;
    classNameSelectList?: string;
    disabled?: boolean;
    placeholder?: string;
    placeholderSearch?: string;
    noResult?: string;
    options: SelectOption[];
    showSearch?: boolean;
    onChange?: (value: string) => void;
    container?: HTMLElement | null;
    groupByKey?: string;
    isAlwayUseOnChange?: boolean;
}

export function Select({
    className,
    classNamePopover,
    classNameSelectList,
    placeholder,
    placeholderSearch,
    size,
    options,
    value: originalValue,
    showSearch = true,
    onChange,
    disabled,
    noResult,
    container,
    groupByKey,
    isAlwayUseOnChange,
    ...rest
}: SelectProps) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(originalValue || "");

    useEffect(() => {
        setValue(originalValue || "");
    }, [originalValue]);

    const handleSelect = (value: string) => {
        setOpen(false);
        if (onChange && (value !== originalValue || !!isAlwayUseOnChange)) {
            onChange(value);
            return;
        }
        setValue(value);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    {...rest}
                    variant="outline"
                    aria-expanded={open}
                    className={cn(selectVariants({ size }), className)}
                    disabled={disabled}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="truncate flex-1 text-left">
                            {value
                                ? options.find(
                                    (item) => item.value.toString() === value.toString(),
                                )?.label ||
                                placeholder ||
                                "Select item..."
                                : placeholder || "Select item..."}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className={cn("w-44 p-1.5", classNamePopover)}
                container={container}
            >
                <SelectList
                    onSelect={handleSelect}
                    options={options}
                    selectedValue={value}
                    highlightedValue={value}
                    placeholder={placeholderSearch}
                    showSearch={showSearch}
                    noResult={noResult}
                    groupBy={groupByKey}
                    className={classNameSelectList}
                />
            </PopoverContent>
        </Popover>
    );
}
