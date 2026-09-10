import { DATE_FORMAT } from "@/app/lib/enums";
import { cn } from "@/app/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@radix-ui/react-icons";
import { cva, VariantProps } from "class-variance-authority";
import { format, isValid, parse, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// This is a custom hook that is used to create a variant system for the InputDatePicker component.
const inputDatePickerVariants = cva(
    ["inline-flex min-w-0 items-center overflow-hidden border rounded-md disabled:bg-light-blue"],
    {
        variants: {
            size: {
                default: ["h-5.5 pl-2 text-body-3", "h-lg:h-8 h-lg:pl-3 h-lg:py-2"],
                sm: "h-5.5 pl-2 py-1 text-body-3",
                md: "h-8 pl-3 py-2 text-body-3",
                lg: "h-9.5 pl-3.5 py-2.5 text-body-1",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);
const calendarButtonVariants = cva(
    ["inline-flex justify-center items-center rounded-md"],
    {
        variants: {
            size: {
                default: ["h-5.5 w-5.5", "h-lg:h-8 h-lg:w-8"],
                sm: "h-5.5 w-5.5",
                md: "h-8 w-8",
                lg: "h-9.5 w-9.5",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

interface InputDatePickerProps
    extends VariantProps<typeof inputDatePickerVariants> {
    value?: Date;
    disabled?: boolean;
    onChange?: (value?: Date) => void;
    onBlur?: (value?: Date) => void;
    onFocus?: (value?: Date) => void;
    className?: string;
    classNameInputs?: string;
    popoverContentClass?: string;
    fallbackBlurDate?: Date;
    clearable?: boolean;
}

export type InputDatePickerRef = {
    focus: (options?: FocusOptions) => void;
};

const dateFormats = Object.values(DATE_FORMAT);

const padWithZero = (val: string) => (val.length === 1 ? `0${val}` : val);

const InputDatePicker = forwardRef<InputDatePickerRef, InputDatePickerProps>(
    (props, ref) => {
        const {
            size,
            value: originalValue,
            disabled,
            onChange,
            onBlur,
            onFocus,
            className,
            classNameInputs,
            popoverContentClass,
            fallbackBlurDate,
            clearable,
        } = props;
        const isChangingFocus = useRef(false);
        const [isOpen, setOpen] = useState(false);
        const [isFocused, setIsFocused] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);
        const dateRef = useRef<HTMLInputElement>(null);
        const monthRef = useRef<HTMLInputElement>(null);
        const yearRef = useRef<HTMLInputElement>(null);

        const value = useRef<Date | undefined>(originalValue);
        const [date, setDate] = useState<string>(
            originalValue ? padWithZero(String(originalValue.getDate())) : "",
        );
        const [month, setMonth] = useState<string>(
            originalValue
                ? padWithZero(String((originalValue.getMonth() || 0) + 1))
                : "",
        );
        const [year, setYear] = useState<string>(
            originalValue ? String(originalValue.getFullYear()) : "",
        );

        const handleChange = useCallback(
            (type: "date" | "month" | "year", value: string) => {
                if (type === "date") {
                    setDate(value);
                }

                if (type === "month") {
                    setMonth(value);
                }

                if (type === "year") {
                    setYear(value);
                }
            },
            [],
        );

        useEffect(() => {
            requestAnimationFrame(() => {
                handleChange(
                    "date",
                    originalValue ? padWithZero(String(originalValue.getDate())) : "",
                );
                handleChange(
                    "month",
                    originalValue
                        ? padWithZero(String((originalValue.getMonth() || 0) + 1))
                        : "",
                );
                handleChange(
                    "year",
                    originalValue ? String(originalValue.getFullYear()) : "",
                );
                value.current = originalValue;
            });
        }, [handleChange, originalValue]);

        useEffect(() => {
            const dateNum = parseInt(date, 10);
            const originalDate = value.current?.getDate();
            if (
                !isChangingFocus.current &&
                isFocused &&
                date.length === 2 &&
                !isNaN(dateNum) &&
                dateNum > 0 &&
                originalDate !== dateNum &&
                document.activeElement?.isEqualNode(dateRef.current)
            ) {
                isChangingFocus.current = true;
                requestAnimationFrame(() => {
                    monthRef.current?.focus();
                    isChangingFocus.current = false;
                });
            }
        }, [date, isFocused]);

        useEffect(() => {
            const monthNum = parseInt(month, 10);
            const originalMonth = value.current && value.current?.getMonth() + 1;
            if (
                !isChangingFocus.current &&
                isFocused &&
                !isNaN(monthNum) &&
                month.length === 2 &&
                monthNum > 0 &&
                monthNum <= 12 &&
                originalMonth !== monthNum &&
                document.activeElement?.isEqualNode(monthRef.current)
            ) {
                isChangingFocus.current = true;
                requestAnimationFrame(() => {
                    yearRef.current?.focus();
                    isChangingFocus.current = false;
                });
            }
        }, [month, isFocused]);

        const internalFocus = useCallback((options?: FocusOptions) => {
            if (
                !isChangingFocus.current &&
                !document.activeElement?.isEqualNode(monthRef.current) &&
                !document.activeElement?.isEqualNode(yearRef.current)
            ) {
                isChangingFocus.current = true;
                requestAnimationFrame(() => {
                    dateRef.current?.focus(options);
                    isChangingFocus.current = false;
                });
            }
        }, []);

        useImperativeHandle(
            ref,
            () => ({
                focus: internalFocus,
            }),
            [internalFocus],
        );

        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            isChangingFocus.current = true;
            if (!isFocused) {
                setIsFocused(true);
                if (onFocus) onFocus(value.current);
            }
            requestAnimationFrame(() => {
                e.target.select();
                isChangingFocus.current = false;
            });
        };

        const validateDate = (date: string): boolean => {
            const dateNum = parseInt(date, 10);
            if (dateNum < 1 || !dateNum) {
                return false;
            } else if (date.length === 1) {
                handleChange("date", `0${date}`);
            }
            return true;
        };

        const validateMonth = (month: string): boolean => {
            const monthNum = parseInt(month, 10);
            if (monthNum < 1 || monthNum > 12 || !monthNum) {
                return false;
            } else if (month.length === 1) {
                handleChange("month", `0${month}`);
            }
            return true;
        };

        const validateYear = (year: string): boolean => {
            const yearNum = parseInt(year.length === 2 ? `20${year}` : year, 10);
            const minYear = 1900;
            const maxYear = 9999;

            return !(!yearNum || yearNum < minYear || yearNum > maxYear);
        };

        const handleBlur = (
            type: "date" | "month" | "year",
            e: React.FocusEvent<HTMLInputElement>,
        ) => {
            let valid = true;

            if (type === "date") {
                valid = validateDate(date);
            } else if (type === "month") {
                valid = validateMonth(month);
            } else if (type === "year") {
                valid = validateYear(year);
            }
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
                setIsFocused(false);

                if (!valid) {
                    const fallbackDate = value.current || fallbackBlurDate;
                    if (fallbackDate) {
                        handleChange("date", padWithZero(String(fallbackDate.getDate())));
                        handleChange(
                            "month",
                            padWithZero(String(fallbackDate.getMonth() + 1)),
                        );
                        handleChange("year", String(fallbackDate.getFullYear()));
                        if (
                            !originalValue ||
                            !isValid(originalValue) ||
                            format(originalValue, DATE_FORMAT.YYYY_MM_DD) !==
                            format(fallbackDate, DATE_FORMAT.YYYY_MM_DD)
                        ) {
                            if (onChange) {
                                onChange(fallbackDate);
                            }
                        }
                    } else {
                        handleChange("date", "");
                        handleChange("month", "");
                        handleChange("year", "");
                    }
                    return;
                }

                let newValue: Date | undefined = new Date(
                    year.length === 2 ? parseInt(`20${year}`, 10) : parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(date, 10),
                );

                if (isNaN(newValue.getTime()) && originalValue) {
                    newValue = new Date(
                        year === ""
                            ? originalValue.getFullYear()
                            : year.length === 2
                                ? parseInt(`20${year}`, 10)
                                : parseInt(year, 10),
                        month === "" ? originalValue.getMonth() : parseInt(month, 10) - 1,
                        date === "" ? originalValue.getDate() : parseInt(date, 10),
                    );
                    if (isNaN(newValue.getTime())) {
                        newValue = originalValue;
                    }
                }

                if (isNaN(newValue.getTime()) && fallbackBlurDate && !originalValue) {
                    newValue = new Date(
                        year === ""
                            ? fallbackBlurDate.getFullYear()
                            : year.length === 2
                                ? parseInt(`20${year}`, 10)
                                : parseInt(year, 10),
                        month === ""
                            ? fallbackBlurDate.getMonth()
                            : parseInt(month, 10) - 1,
                        date === "" ? fallbackBlurDate.getDate() : parseInt(date, 10),
                    );
                    if (isNaN(newValue.getTime())) {
                        newValue = fallbackBlurDate;
                    }
                }

                const lastDate = new Date(
                    newValue.getFullYear(),
                    parseInt(month, 10),
                    0,
                );
                const dateNum = parseInt(date, 10);
                if (dateNum && dateNum > lastDate.getDate()) {
                    newValue = fallbackBlurDate;
                }

                if (onBlur) onBlur(newValue);
                handleDateChange(newValue);
            }
        };

        const handleDateChange = (date?: Date) => {
            if (!date) {
                handleChange(
                    "date",
                    originalValue ? padWithZero(String(originalValue.getDate())) : "",
                );
                handleChange(
                    "month",
                    originalValue
                        ? padWithZero(String((originalValue.getMonth() || 0) + 1))
                        : "",
                );
                handleChange(
                    "year",
                    originalValue ? String(originalValue.getFullYear()) : "",
                );
                return;
            }
            if (
                !originalValue ||
                !isValid(originalValue) ||
                (isValid(date) &&
                    format(originalValue, DATE_FORMAT.YYYY_MM_DD) !==
                    format(date, DATE_FORMAT.YYYY_MM_DD))
            ) {
                if (onChange) {
                    onChange(date);
                } else {
                    value.current = date;
                    handleChange("date", padWithZero(String(date.getDate())));
                    handleChange("month", padWithZero(String(date.getMonth() + 1)));
                    handleChange("year", String(date.getFullYear()));
                }
            }
        };
        const handleDateClear = () => {
            handleChange("date", "");
            handleChange("month", "");
            handleChange("year", "");
            if (onChange) onChange(undefined);
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (value && (e.ctrlKey || e.metaKey) && e.key === "c") {
                handleCopyToClipboard();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                isChangingFocus.current = true;
                requestAnimationFrame(() => {
                    dateRef.current?.focus();
                    isChangingFocus.current = false;
                });
            }

            if (e.key === "Enter") {
                if (document.activeElement?.isEqualNode(dateRef.current)) {
                    handleBlur(
                        "date",
                        e as unknown as React.FocusEvent<HTMLInputElement>,
                    );
                } else if (document.activeElement?.isEqualNode(monthRef.current)) {
                    handleBlur(
                        "month",
                        e as unknown as React.FocusEvent<HTMLInputElement>,
                    );
                } else if (document.activeElement?.isEqualNode(yearRef.current)) {
                    handleBlur(
                        "year",
                        e as unknown as React.FocusEvent<HTMLInputElement>,
                    );
                }
            }

            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
                return;
            e.preventDefault();
            if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                if (document.activeElement?.isEqualNode(yearRef.current)) {
                    monthRef.current?.focus();
                } else if (document.activeElement?.isEqualNode(monthRef.current)) {
                    dateRef.current?.focus();
                }
            }
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                if (document.activeElement?.isEqualNode(dateRef.current)) {
                    monthRef.current?.focus();
                } else if (document.activeElement?.isEqualNode(monthRef.current)) {
                    yearRef.current?.focus();
                }
            }
        };

        const handleCopyToClipboard = () => {
            (document.activeElement as HTMLElement)?.blur();
            requestAnimationFrame(() => {
                const dateStr = `${padWithZero(date)}/${padWithZero(month)}/${year}`;
                void navigator.clipboard.writeText(dateStr);
            });
        };

        const handlePasteFromClipboard = (
            e: React.ClipboardEvent<HTMLInputElement>,
        ) => {
            if (disabled) return;

            const paste = e.clipboardData.getData("text");
            let newDate: Date | null = null;
            for (const formatStr of dateFormats) {
                const isISO8601 = formatStr === DATE_FORMAT.ISO_8601;
                if (paste) {
                    const parsedDate = isISO8601
                        ? parseISO(paste)
                        : parse(paste, formatStr, new Date());
                    if (isValid(parsedDate)) {
                        newDate = parsedDate;
                        break;
                    }
                }
            }
            if (newDate) {
                handleDateChange(newDate);
            }
            e.preventDefault();
        };

        return (
            <div className={cn(inputDatePickerVariants({ size }), className)}>
                <div
                    className={cn("flex min-w-0 flex-1 items-center", classNameInputs)}
                    ref={containerRef}
                >
                    <input
                        type="number"
                        aria-label="date"
                        disabled={disabled}
                        max={31}
                        min={1}
                        value={date || ""}
                        onChange={(e) => handleChange("date", e.target.value)}
                        onFocus={handleFocus}
                        onBlur={(e) => handleBlur("date", e)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePasteFromClipboard}
                        className="w-6 min-w-0 flex-1 bg-transparent text-center outline-none disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        ref={dateRef}
                    />
                    <span className="text-muted-foreground text-sm pointer-events-none">
                        /
                    </span>
                    <input
                        type="number"
                        aria-label="month"
                        disabled={disabled}
                        max={12}
                        min={1}
                        value={month || ""}
                        onChange={(e) => handleChange("month", e.target.value)}
                        onFocus={handleFocus}
                        onBlur={(e) => handleBlur("month", e)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePasteFromClipboard}
                        className="w-6 min-w-0 flex-1 bg-transparent text-center outline-none disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        ref={monthRef}
                    />
                    <span className="text-muted-foreground text-sm pointer-events-none">
                        /
                    </span>
                    <input
                        type="number"
                        aria-label="year"
                        disabled={disabled}
                        min={1900}
                        value={year || ""}
                        onChange={(e) => handleChange("year", e.target.value)}
                        onFocus={handleFocus}
                        onBlur={(e) => handleBlur("year", e)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePasteFromClipboard}
                        className="w-12 min-w-0 flex-[2] bg-transparent text-center outline-none disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        ref={yearRef}
                    />
                </div>
                <Popover open={isOpen} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            disabled={disabled}
                            onClick={(e) => {
                                setOpen(!isOpen);
                                e.stopPropagation();
                            }}
                            className={cn(calendarButtonVariants({ size }), "shrink-0")}
                            tabIndex={-1}
                        >
                            <CalendarIcon className="w-3 h-3" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        className={`w-auto p-0 ${popoverContentClass ?? "z-[9999]"}`}
                    >
                        <Calendar
                            captionLayout="dropdown"
                            mode="single"
                            selected={value.current}
                            defaultMonth={value.current}
                            onSelect={(date) => {
                                if (date) {
                                    handleDateChange(date);
                                }
                                setOpen(false);
                            }}
                            locale={vi}
                            footer={
                                <div className="pt-2 text-body-3 flex flex-row items-center justify-end gap-1">
                                    {value.current && (
                                        <>
                                            <span className="flex-1">{`${padWithZero(date)}/${padWithZero(month)}/${year}`}</span>
                                            <Button onClick={handleCopyToClipboard} variant="outline">
                                                Sao chép
                                            </Button>
                                        </>
                                    )}

                                    <Button
                                        onClick={() => {
                                            handleDateChange(
                                                new Date(new Date().setHours(0, 0, 0, 0)),
                                            );
                                            setOpen(false);
                                        }}
                                        variant="outline"
                                    >
                                        Hôm nay
                                    </Button>

                                    {clearable && (
                                        <>
                                            <Button
                                                onClick={() => {
                                                    handleDateClear();
                                                    setOpen(false);
                                                }}
                                                variant="outline"
                                            >
                                                Xóa
                                            </Button>
                                        </>
                                    )}
                                </div>
                            }
                        />
                    </PopoverContent>
                </Popover>
            </div>
        );
    },
);

InputDatePicker.displayName = "InputDatePicker";
export { InputDatePicker };

