import { extendTailwindMerge } from "tailwind-merge";
import { type ClassValue, clsx } from "clsx";
const textSizeRegex = /^(headline|title|body)-(\d)$/;
const textColorRegex = /^(primary|secondary|destructive)(\-foreground)?$/;

const isTextSize = (value: string) => textSizeRegex.test(value);
const isTextColor = (value: string) => textColorRegex.test(value);
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [isTextSize] }],
      "text-color": [{ text: [isTextColor] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export function normalizeString(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const transformDecivalToVietnameseFormat = (value: string): string => {
  return value.replaceAll(".", "").replaceAll(",", ".");
};