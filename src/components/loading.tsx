"use client";
import { ELoadingMessages } from "@/app/lib/enums";
import { cn } from "@/app/lib/utils";
import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

export function LoadingUI({
    message = ELoadingMessages.LOADING_DATA,
    popupClass = "z-[200]",
}: {
    message?: string;
    popupClass?: string;
}) {
    return (
        <div
            className={cn(
                "fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 !pointer-events-auto bg-gray-900/50",
                popupClass,
            )}
        >
            <div className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            <p className="text-sm text-white">{message}...</p>
        </div>
    );
}

const useLoading = () => {
    const instances = useRef<string[]>([]);

    const showLoading = useCallback((message: string, popupClass?: string) => {
        const id = uuidv4();
        const isMultilineMessage = message.includes("\n");
        const container = document.createElement("div");
        container.id = id;
        container.role = "status";
        container.className = cn(
            "fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 !pointer-events-auto bg-gray-900/50",
            popupClass || "z-[200]",
        );
        container.innerHTML = `
      <div class="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin"></div>
      <p class="${cn("text-sm text-white", isMultilineMessage && "whitespace-pre-line text-center")}">${message}...</p>
    `;
        document.body.appendChild(container);

        instances.current.push(id);
        return id;
    }, []);

    const hideLoading = useCallback((id: string) => {
        const index = instances.current.findIndex((loadingId) => loadingId === id);
        if (index !== -1) {
            instances.current.splice(index, 1);
        }
        const loadingElement = document.getElementById(id);
        if (loadingElement) {
            loadingElement.remove();
        }
    }, []);

    useEffect(() => {
        return () => {
            instances.current.forEach((loadingId) => {
                const loadingElement = document.getElementById(loadingId);
                if (loadingElement) {
                    loadingElement.remove();
                }
            });
            instances.current = [];
        };
    }, []);

    return { showLoading, hideLoading };
};

export default useLoading;
