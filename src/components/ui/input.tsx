import { cn } from "@/app/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import * as React from "react";

export const inputVariants = cva(
  [
    "flex w-full rounded border bg-white text-dark-sky transition-colors",
    "placeholder:text-day-light",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
    "disabled:cursor-not-allowed disabled:bg-light-blue",
  ],
  {
    variants: {
      size: {
        default: [
          "h-5.5 px-2 py-1 text-body-3",
          "h-lg:h-8 h-lg:px-3 h-lg:py-2",
        ],
        sm: "h-5.5 px-2 py-1 text-body-3",
        md: "h-8 px-3 py-2 text-body-3",
        lg: "h-9.5 px-3.5 py-2.5 text-body-1",
      },
      variant: {
        default: "",
        copyable: "cursor-text",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    compoundVariants: [
      {
        variant: "copyable",
        className: "disabled:cursor-text",
      },
    ],
  },
);

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  VariantProps<typeof inputVariants> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, variant, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants({ size, variant }),
          type === "number" && "[appearance:textfield]",
          error && "border-destructive focus-visible:ring-destructive",
          !error && "border-stroke-90",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

