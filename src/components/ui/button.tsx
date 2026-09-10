"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/app/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:bg-destructive/90",
                outline:
                    "border text-primary bg-background hover:bg-accent hover:text-accent-foreground focus:bg-accent",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:bg-secondary/80",
                ghost:
                    "hover:bg-accent text-primary hover:text-accent-foreground focus:bg-accent",
                link: "text-primary underline-offset-4 hover:underline focus:underline",
            },
            size: {
                default: ["h-5.5 px-2.5 py-2 text-body-3", "h-lg:h-8 h-lg:px-4"],
                sm: "h-5.5 px-2.5 py-2 text-body-3",
                md: "h-8 px-3",
                lg: "h-10 px-8 text-body-1",
                icon: "h-5.5 w-5.5 h-lg:h-8 h-lg:w-8",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                ref={ref}
                className={cn(
                    buttonVariants({ variant, size }),
                    className,
                    "fs-unmask",
                )}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export { Button, buttonVariants };
