"use client";
import { ELoadingMessages } from "@/app/lib/enums";
import { cn } from "@/app/lib/utils";
import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

export function LoadingUI({
    message = ELoadingMessages.LOADING_DATA,
    popupClass = "z-110",
}: {
    message?: string;
    popupClass?: string;
}) {
    return (
        <div
            className={cn(
                "fixed inset-0 flex items-center justify-center !pointer-events-auto",
                popupClass,
            )}
        >
            <div className="flex items-center justify-center space-x-2 w-[250px] h-[60px] text-black bg-slate-100 border-2 border-[#ffcc00] rounded-md">
                <p className=" text-black flex items-center">{message}...</p>
            </div>
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
            "fixed inset-0 flex items-center justify-center !pointer-events-auto",
            popupClass || "z-110",
        );
        container.innerHTML = `
      <div class="${cn(
            "flex items-center justify-center space-x-2 w-[250px] h-[60px] text-black bg-slate-100 border-2 border-[#ffcc00] rounded-md",
            isMultilineMessage && "whitespace-pre-line text-center",
        )}">
        <p class="text-black flex items-center">${message}...</p>
      </div>
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
