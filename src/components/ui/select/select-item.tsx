"use client";

import { cn } from "@/app/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import React from "react";

const selectItemVariants = cva(
    "flex flex-row gap-1 items-center cursor-pointer rounded hover:bg-light-blue whitespace-nowrap",
    {
        variants: {
            size: {
                default: "px-3 py-2 text-body-3 h-lg:py-2.5",
                sm: "px-3 py-2 text-body-3",
                md: "py-2.5 text-body-3",
                lg: "px-3.5 py-3 text-body-1",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

interface SelectItemProps {
    className?: string;
    value: string;
    label: string;
    onSelect: (value: string) => void;
    prefix?: React.ReactNode;
}

interface SelectItemProps extends VariantProps<typeof selectItemVariants> {
    value: string;
    label: string;
    onSelect: (value: string) => void;
}

const SelectItem: React.FC<SelectItemProps> = ({
    className,
    size,
    value,
    label,
    onSelect,
    prefix,
}) => {
    const handleClick = () => {
        onSelect(value);
    };

    return (
        <li
            onClick={handleClick}
            className={cn(selectItemVariants({ size }), className)}
        >
            {prefix}
            {label}
        </li>
    );
};

export default SelectItem;
