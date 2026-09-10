"use client";

import { DATE_FORMAT } from "@/app/lib/enums";
import { cn } from "@/app/lib/utils";
import { Select } from "@/components/ui/select/select";
import { SelectOption } from "@/components/ui/select/select-list";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputDatePicker } from "@/components/ui/input-date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, isValid, parseISO } from "date-fns";
import { Control, FieldPath, FieldValues } from "react-hook-form";

type CommonProps<TForm extends FieldValues> = {
  control: Control<TForm>;
  name: FieldPath<TForm>;
  label: string;
  className?: string;
  /** Đánh dấu * đỏ để người dùng biết trường buộc phải nhập trước khi bấm Lưu. */
  required?: boolean;
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Label className="whitespace-nowrap">
      {label}
      {required && <span className="text-error-500"> *</span>}
    </Label>
  );
}

export function TextFormField<TForm extends FieldValues>({
  control,
  name,
  label,
  className,
  required,
  type = "text",
}: CommonProps<TForm> & { type?: string }) {
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <FormItem className="gap-2 w-full">
            <FormControl className="flex-1">
              <Input
                {...field}
                type={type}
                error={!!fieldState.error}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  field.onChange(type === "number" ? e.target.valueAsNumber || 0 : e.target.value)
                }
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function TextAreaFormField<TForm extends FieldValues>({
  control,
  name,
  label,
  className,
  required,
}: CommonProps<TForm>) {
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <FormItem className="gap-2 w-full">
            <FormControl className="flex-1">
              <Textarea
                {...field}
                value={field.value ?? ""}
                className={cn(fieldState.error && "border-destructive focus-visible:ring-destructive")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/**
 * Chọn ngày bằng calendar (dùng InputDatePicker sẵn có: nhập tay hoặc chọn trên lịch, có nút Hôm nay / Xóa).
 * Giá trị lưu trong form là chuỗi "yyyy-MM-dd" để so sánh / lưu Firestore trực tiếp.
 */
export function DateFormField<TForm extends FieldValues>({
  control,
  name,
  label,
  className,
  required,
  clearable = true,
}: CommonProps<TForm> & { clearable?: boolean }) {
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => {
          const parsed = field.value ? parseISO(String(field.value)) : undefined;
          return (
            <FormItem className="gap-2 w-full">
              <FormControl className="flex-1">
                <InputDatePicker
                  size="md"
                  // Không dùng w-full: 3 ô ngày/tháng/năm bên trong là flex-1 nên sẽ giãn rất rộng.
                  className={cn("w-44", fieldState.error && "border-destructive")}
                  clearable={clearable}
                  value={parsed && isValid(parsed) ? parsed : undefined}
                  onChange={(date) => field.onChange(date ? format(date, DATE_FORMAT.YYYY_MM_DD) : "")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}

export function SelectFormField<TForm extends FieldValues>({
  control,
  name,
  label,
  className,
  required,
  options,
  placeholder,
}: CommonProps<TForm> & { options: SelectOption[]; placeholder?: string }) {
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <FormItem className="gap-2 w-full">
            <FormControl className="flex-1">
              <Select
                options={options}
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder={placeholder}
                className={cn("w-full", fieldState.error && "border-destructive")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
