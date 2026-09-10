"use client";

import { cn } from "@/app/lib/utils";
import Fuse from "fuse.js";
import { ChevronRight } from "lucide-react";
import React, {
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { SearchInput } from "./search-input";
import { Label } from "@radix-ui/react-label";
import SelectItem from "./select-item";
import { Checkbox } from "../checkbox";

export interface SelectOption {
    value: string;
    label: string;
    deptName?: string;
}

interface SelectListProps {
    selectedValue: string | string[];
    highlightedValue?: string;
    options: SelectOption[];
    onSelect: (value: string) => void;
    multiple?: boolean;
    showSearch?: boolean;
    placeholder?: string;
    noResult?: string;
    selectAllEnabled?: boolean;
    onSelectAllChange?: (value: boolean) => void;
    selectAllValue?: boolean;
    groupBy?: string;
    className?: string;
}

const SelectList: React.FC<SelectListProps> = ({
    selectedValue,
    options: originalOptions,
    onSelect,
    multiple,
    highlightedValue: originalHighlightedValue,
    showSearch,
    placeholder,
    noResult = "Không có dữ liệu",
    selectAllEnabled,
    onSelectAllChange,
    selectAllValue,
    groupBy,
    className,
}) => {
    const [isMounted, setIsMouned] = useState<boolean>(false);

    const [query, setQuery] = useState("");
    const searching = useRef<boolean>(false);
    const [highlightedValue, setHighlightedValue] = useState(
        originalHighlightedValue || "",
    );
    const deferredQuery = useDeferredValue(query);
    const listRef = useRef<HTMLUListElement>(null);

    const countDeptName = useMemo(
        () =>
            !!groupBy
                ? [
                    ...new Set([
                        ...originalOptions.map(
                            (item) => item[groupBy as keyof SelectOption],
                        ),
                    ]),
                ]
                : null,
        [groupBy, originalOptions],
    );

    const options = useMemo(() => {
        searching.current = true;
        if (!deferredQuery) {
            searching.current = false;
            return originalOptions;
        }

        const fuse = new Fuse(originalOptions, {
            keys: ["label"],
            threshold: 0.3,
        });

        return fuse.search(deferredQuery).map((result) => result.item);
    }, [originalOptions, deferredQuery]);

    const isSelected = useCallback(
        (item: SelectOption) => {
            if (multiple) {
                return (selectedValue as string[]).includes(item.value);
            }
            return selectedValue.toString() === item.value.toString();
        },
        [selectedValue, multiple],
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && highlightedValue) {
            onSelect(highlightedValue);
            return;
        }
        const index = options.findIndex(
            (item) => item.value.toString() === highlightedValue?.toString(),
        );
        if (e.key === "ArrowDown") {
            if (index === -1) {
                setHighlightedValue(options[0].value);
                return;
            }
            if (index === options.length - 1) {
                return;
            }
            setHighlightedValue(options[index + 1].value);
        }
        if (e.key === "ArrowUp") {
            if (index === -1) {
                setHighlightedValue(options[options.length - 1].value);
                return;
            }
            if (index === 0) {
                return;
            }
            setHighlightedValue(options[index - 1].value);
        }
    };

    useEffect(() => {
        if (multiple) {
            return;
        }
        if (!selectedValue) {
            return;
        }
        const index = options.findIndex((item) => isSelected(item));
        if (index === -1) {
            return;
        }
        if (searching.current) {
            requestAnimationFrame(() => {
                listRef.current?.scrollTo({ top: 0 });
            });
            return;
        }
        requestAnimationFrame(() => {
            listRef.current?.children[index]?.scrollIntoView({
                block: "center",
            });
        });
    }, [selectedValue, options, isSelected, multiple]);

    useEffect(() => {
        setIsMouned(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    return (
        <>
            {showSearch && (
                <SearchInput
                    tabIndex={0}
                    className="mb-1.5 h-lg:mb-2"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            )}
            <ul
                className={cn(
                    "space-y-0.5 max-h-48  overflow-auto outline-none",
                    className,
                )}
                tabIndex={1}
                onKeyDown={handleKeyDown}
                ref={listRef}
            >
                {selectAllEnabled && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="select-all-checkbox"
                            checked={selectAllValue}
                            onCheckedChange={onSelectAllChange}
                        />
                        <Label htmlFor="select-all-checkbox">Chọn tất cả</Label>
                    </div>
                )}
                {options.length > 0 ? (
                    !!countDeptName && countDeptName.length > 0 ? (
                        countDeptName.map((groupName) => (
                            <SelectItemGroup
                                key={groupName as string}
                                groupName={groupName!}
                                data={options}
                                groupBy={groupBy!}
                                onSelect={onSelect}
                                highlightedValue={highlightedValue}
                                multiple={multiple}
                                isSelected={isSelected}
                            />
                        ))
                    ) : (
                        options.map((item) => (
                            <SelectItem
                                key={item.value}
                                value={item.value}
                                label={item.label}
                                onSelect={onSelect}
                                className={
                                    highlightedValue?.toString() === item.value.toString()
                                        ? "bg-light-blue"
                                        : ""
                                }
                                prefix={
                                    multiple ? (
                                        <Checkbox
                                            className="pointer-events-none"
                                            checked={isSelected(item)}
                                        />
                                    ) : undefined
                                }
                            />
                        ))
                    )
                ) : (
                    <p className="text-body-3">{noResult}</p>
                )}
            </ul>
        </>
    );
};

export default SelectList;

function SelectItemGroup({
    groupName,
    data,
    groupBy,
    onSelect,
    highlightedValue,
    multiple,
    isSelected,
}: {
    groupName: string;
    data: SelectOption[];
    groupBy: string;
    onSelect: (value: string) => void;
    highlightedValue: string;
    multiple?: boolean;
    isSelected: (item: SelectOption) => boolean;
}) {
    const [isExtend, setIsExtend] = useState(true);

    const renderContent = useCallback(
        () =>
            data
                .filter((item) => item[groupBy! as keyof SelectOption] === groupName)
                .map((item) => (
                    <SelectItem
                        key={item.value}
                        value={item.value}
                        label={item.label}
                        onSelect={onSelect}
                        className={
                            highlightedValue?.toString() === item.value.toString()
                                ? "bg-light-blue"
                                : ""
                        }
                        prefix={
                            multiple ? (
                                <Checkbox
                                    className="pointer-events-none"
                                    checked={isSelected(item)}
                                />
                            ) : undefined
                        }
                    />
                )),
        [
            data,
            groupBy,
            groupName,
            highlightedValue,
            isSelected,
            multiple,
            onSelect,
        ],
    );

    return (
        <>
            <span
                className="flex items-center bg-gradient-custom flex-row cursor-pointer font-bold"
                onClick={() => setIsExtend((prev) => !prev)}
            >
                <ChevronRight
                    className={cn(
                        "rotate-90 size-4 text-black transition-transform",
                        !isExtend && "rotate-0",
                    )}
                />
                Khoa: {groupName as string}
            </span>
            {isExtend && renderContent()}
        </>
    );
}
