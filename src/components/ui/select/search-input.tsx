"use client";

import { Search } from "lucide-react";

import { cn } from "@/app/lib/utils";
import { Input } from "@/components/ui/input";
import { cva, VariantProps } from "class-variance-authority";

const containerVariants = cva("relative", {
    variants: {
        size: {
            default: "",
            sm: "",
            md: "",
            lg: "",
        },
    },
    defaultVariants: {
        size: "default",
    },
});

const searchIconVariants = cva("shrink-0 opacity-50 absolute", {
    variants: {
        size: {
            default:
                "w-3 h-3 right-1 top-1 h-lg:right-2 h-lg:top-2 h-lg:w-4 h-lg:h-4",
            sm: "w-3 h-3 right-1 top-1",
            md: "w-4 h-4 right-2 top-2",
            lg: "w-4 h-4 right-2.5 top-2.5",
        },
    },
    defaultVariants: {
        size: "default",
    },
});

const searchInputVariants = cva("", {
    variants: {
        size: {
            default: "pr-5 h-lg:pr-7",
            sm: "pr-5",
            md: "pr-7",
            lg: "pr-8",
        },
    },
    defaultVariants: {
        size: "default",
    },
});

interface SearchInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof searchInputVariants> {
    classNameInput?: string;
    classNameIcon?: string;
}

export function SearchInput({
    className,
    classNameIcon,
    classNameInput,
    size,
    ...props
}: SearchInputProps) {
    return (
        <div className={cn(containerVariants({ size }), className)}>
            <Input
                {...props}
                className={cn(searchInputVariants({ size }), classNameInput)}
                size={size}
            />
            <Search className={cn(searchIconVariants({ size }), classNameIcon)} />
        </div>
    );
}
