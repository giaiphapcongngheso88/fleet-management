// EditableCustomerPercentageCell.tsx
import { useFeedbackDialog } from "@/app/lib/feedback-dialog-provider";
import { transformDecivalToVietnameseFormat } from "@/app/lib/utils";
import { Input } from "@/components/ui/input";
import { CANH_BAO } from "@/utils/enums";
import { useRef } from "react";
import { NumericFormat } from "react-number-format";

export default function InputAvailableQtyCommon({
    availableQty,
    onChange,
    disabled,
    decimalScale,
    className,
    content,
}: {
    availableQty: string | number;
    onChange: (newValue: string) => void;
    disabled?: boolean;
    decimalScale?: number;
    className?: string;
    content?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { alert } = useFeedbackDialog();
    const hasChanged = useRef<boolean>(false);
    return (
        <NumericFormat
            getInputRef={(el: HTMLInputElement | null) => {
                inputRef.current = el;
            }}
            disabled={disabled}
            value={availableQty}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={decimalScale ?? 4}
            className={className}
            fixedDecimalScale={false}
            allowNegative={false}
            customInput={Input}
            onValueChange={() => {
                hasChanged.current = true;
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
            }}
            onBlur={async (e) => {
                const newValue = e.currentTarget.value;
                if (hasChanged.current === true && !newValue) {
                    await alert({
                        title: CANH_BAO,
                        content: content ?? "Vui lòng nhập dữ liệu",
                    });
                    inputRef.current?.focus();
                    inputRef.current?.select();
                    return;
                }
                onChange(transformDecivalToVietnameseFormat(newValue));
            }}
        />
    );
}
