"use client";

import * as React from "react";

import { cn } from "@/app/lib/utils";

// @deprecated Use DataTable component instead
const Table = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <div className="relative w-full">
        <table
            ref={ref}
            className={cn("w-full caption-bottom text-xs", className)}
            {...props}
        />
    </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <thead
        ref={ref}
        className={cn("[&_tr]:border-b sticky top-0 bg-white", className)}
        {...props}
    />
));
TableHeader.displayName = "TableHeader";

const TableHeaderFilter = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <thead
        ref={ref}
        className={cn(
            "[&_tr]:border-b sticky top-[21px] h-lg:top-[34px] bg-white",
            className,
        )}
        {...props}
    />
));
TableHeaderFilter.displayName = "TableHeaderFilter";

const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn(className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tfoot
        ref={ref}
        className={cn(
            "border-t bg-muted font-medium [&>tr]:last:border-b-0",
            className,
        )}
        {...props}
    />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn(
            "border-b hover:bg-sky-blue data-[state=selected]:bg-primary h-4 divide-x",
            className,
        )}
        {...props}
    />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            "uppercase py-0.5 px-1 text-left align-top text-headline-3 [&:has([role=checkbox])]:pr-0 bg-blue-base text-white",
            "h-lg:py-2 h-lg:px-3 h-lg:text-headline-2 fs-unmask",
            className,
        )}
        {...props}
    />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn(
            "align-middle [&:has([role=checkbox])]:pr-0 px-2 py-1 text-body-3",
            "h-lg:py-2 h-lg:px-3",
            className,
        )}
        {...props}
    />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
    HTMLTableCaptionElement,
    React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
    <caption
        ref={ref}
        className={cn("mt-4 text-body-3 text-muted-foreground", className)}
        {...props}
    />
));
TableCaption.displayName = "TableCaption";

export {
    Table as DeprecatedTable,
    TableBody as DeprecatedTableBody,
    TableCell as DeprecatedTableCell,
    TableFooter as DeprecatedTableFooter,
    TableHead as DeprecatedTableHead,
    TableHeader as DeprecatedTableHeader,
    TableHeaderFilter as DeprecatedTableHeaderFilter,
    TableRow as DeprecatedTableRow,
};
