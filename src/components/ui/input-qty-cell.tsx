import { cn } from "@/app/lib/utils";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";

const InputQtyCell = ({
    value,
    disabled,
    onChange,
    onKeyDown,
}: {
    value: number;
    disabled?: boolean;
    onChange?: (value: number) => void;
    onKeyDown?: (value: number) => void;
}) => {
    const [qtyEdit, setQtyEdit] = useState<number | undefined>(value);

    const isChanged = value !== qtyEdit;
    const className = cn("border", isChanged ? "border-yellow-500" : "");
    useEffect(() => {
        setQtyEdit(value);
    }, [value]);

    return (
        <NumericFormat
            disabled={disabled}
            className={className}
            value={qtyEdit}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={3}
            fixedDecimalScale={false}
            allowNegative={false}
            customInput={Input}
            onValueChange={(values) => {
                if (values.floatValue !== undefined) {
                    setQtyEdit(values.floatValue);
                } else {
                    setQtyEdit(0);
                }
            }}
            onFocus={(e) => {
                e.target.select();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (qtyEdit === undefined || qtyEdit < 0) {
                        setQtyEdit(0);
                    }
                    onChange?.(qtyEdit ?? 0);
                    onKeyDown?.(qtyEdit ?? 0);
                }
            }}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onBlur={(e) => {
                if (qtyEdit === undefined || qtyEdit < 0) {
                    setQtyEdit(0);
                }
                onChange?.(qtyEdit ?? 0);
            }}
        />
    );
};

export default InputQtyCell;
