"use client";
import { cn } from "@/app/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DOMPurify from "dompurify";
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

// Define types
type ConfirmFunction = ({
    title,
    content,
    buttonLabels,
    className,
}: {
    title: string;
    content?: string;
    buttonLabels?: Partial<Record<ConfirmButton[number], string>>;
    className?: string;
}) => Promise<void | boolean>;

type ConfirmContextType = {
    alert: ConfirmFunction;
    confirm: ConfirmFunction;
    decision: ConfirmFunction;
    closeDialog: () => void;
};

export enum ConfirmButton {
    Ok = "Ok",
    Yes = "Yes",
    No = "No",
    Cancel = "Cancel",
}

export const AlertButtonType = [ConfirmButton.Ok];
export const ConfirmButtonType = [ConfirmButton.Yes, ConfirmButton.No];
export const DecisionButtonType = [
    ConfirmButton.Yes,
    ConfirmButton.No,
    ConfirmButton.Cancel,
];
const ALERT_BUTTON_LABELS: Partial<
    Record<(typeof AlertButtonType)[number], string>
> = {
    [ConfirmButton.Ok]: "Ok",
};
const CONFIRM_BUTTON_LABELS: Partial<
    Record<(typeof ConfirmButtonType)[number], string>
> = {
    [ConfirmButton.Yes]: "Có",
    [ConfirmButton.No]: "Không",
};
const DECISION_BUTTON_LABELS: Partial<
    Record<(typeof DecisionButtonType)[number], string>
> = {
    [ConfirmButton.Yes]: "Có",
    [ConfirmButton.No]: "Không",
    [ConfirmButton.Cancel]: "Hủy",
};

const BUTTON_STYLES: Partial<
    Record<
        ConfirmButton[number],
        "link" | "default" | "outline" | "ghost" | "destructive" | "secondary"
    >
> = {
    [ConfirmButton.Ok]: "default",
    [ConfirmButton.Yes]: "default",
    [ConfirmButton.No]: "outline",
    [ConfirmButton.Cancel]: "secondary",
};

// Only allows a whitelist of safe HTML tags and limited attributes
const ALLOWED_TAGS = [
    "b",
    "i",
    "u",
    "span",
    "div",
    "p",
    "h1",
    "h2",
    "h3",
    "ol",
    "ul",
    "li",
    "style",
];
const ALLOWED_ATTR = ["style", "class"];

type ButtonType =
    | typeof AlertButtonType
    | typeof ConfirmButtonType
    | typeof DecisionButtonType;

type DialogState<T extends ButtonType> = {
    open: boolean;
    title: string;
    message: string;
    buttons: T;
    buttonLabels: Partial<Record<T[number], string>>;
    className?: string;
    onClose: (button: T[number]) => void;
};

type ConfirmDialogProps<T extends ButtonType> = {
    open: boolean;
    title: string;
    message: string;
    buttons: T;
    buttonLabels: Partial<Record<T[number], string>>;
    className?: string;
    onClose: (button: T[number]) => void;
};

type FeedbackDialogProviderProps = {
    children: ReactNode;
};

const broadcast = new BroadcastChannel("feedback-dialog");

const FeedbackDialogContext = createContext<ConfirmContextType | undefined>(
    undefined,
);

const ConfirmDialog = <T extends ButtonType>({
    open,
    title,
    message,
    buttons,
    buttonLabels,
    className,
    onClose,
}: ConfirmDialogProps<T>) => {
    const isMultilineMessage = message.includes("\n");
    const footerRef = useRef<HTMLDivElement>(null);

    const handleButtonClick = (button: T[number]) => {
        onClose(button);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const buttons = footerRef.current?.querySelectorAll("button");
        if (!buttons) return;

        const currentIndex = Array.from(buttons).indexOf(
            event.target as HTMLButtonElement,
        );
        if (currentIndex === -1) return;

        if (event.key === "ArrowRight") {
            const nextIndex = (currentIndex + 1) % buttons.length;
            buttons[nextIndex].focus({ preventScroll: true });
        } else if (event.key === "ArrowLeft") {
            const prevIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            buttons[prevIndex].focus({ preventScroll: true });
        }
    };

    const extractStyles = (html: string) => {
        const sanitizedFragment = DOMPurify.sanitize(html, {
            ALLOWED_TAGS,
            ALLOWED_ATTR,
            WHOLE_DOCUMENT: true,
            RETURN_DOM: true,
        }) as DocumentFragment;

        const tempDiv = document.createElement("div");
        tempDiv.appendChild(sanitizedFragment);

        let extractedStyles = "";
        tempDiv.querySelectorAll("style").forEach((style) => {
            extractedStyles += style.innerHTML;
            style.remove();
        });

        return { sanitizedHtml: tempDiv.innerHTML, extractedStyles };
    };

    const hasHTML = (str: string) => /<\/?[a-z][\s\S]*>/i.test(str);

    const setContainerRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (!node) return;

            let shadowRoot = node.shadowRoot;
            if (!shadowRoot) {
                shadowRoot = node.attachShadow({ mode: "open" });
            }

            shadowRoot.innerHTML = "";

            if (!hasHTML(message)) {
                shadowRoot.innerHTML = `<span>${DOMPurify.sanitize(message)}</span>`;
                return;
            }

            const { sanitizedHtml, extractedStyles } = extractStyles(message);

            const styleElement = document.createElement("style");
            styleElement.textContent = extractedStyles;

            const contentWrapper = document.createElement("div");
            contentWrapper.innerHTML = sanitizedHtml;

            shadowRoot.appendChild(styleElement);
            shadowRoot.appendChild(contentWrapper);
        },
        [message],
    );

    return (
        <AlertDialog open={open}>
            <AlertDialogContent
                className={cn(
                    "max-w-80 bg-white z-[1999999999] fs-unmask",
                    isMultilineMessage && "max-w-lg",
                    className,
                )}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    footerRef.current
                        ?.querySelector("button")
                        ?.focus({ preventScroll: true });
                }}
            >
                <AlertDialogHeader>
                    <div className="mx-auto">
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 48 48"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle opacity="0.05" cx="24" cy="24" r="24" fill="#C41313" />
                            <circle opacity="0.1" cx="24" cy="24" r="18" fill="#C41313" />
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M23.9998 16.2916C28.2573 16.2916 31.7082 19.7433 31.7082 24C31.7082 28.2566 28.2573 31.7083 23.9998 31.7083C19.7432 31.7083 16.2915 28.2566 16.2915 24C16.2915 19.7433 19.7432 16.2916 23.9998 16.2916Z"
                                stroke="#C41313"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <path
                                d="M23.9956 20.8367V24.5192"
                                stroke="#C41313"
                                strokeWidth="1.5"
                                strokeLinecap="square"
                            />
                            <path
                                d="M23.9956 27.1632H24.005"
                                stroke="#C41313"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                    <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
                    <AlertDialogDescription
                        className={cn(
                            isMultilineMessage
                                ? "mt-4 max-h-[50vh] overflow-y-auto pr-2 flex flex-col items-start whitespace-pre-line text-center leading-5"
                                : "text-center",
                        )}
                    >
                        <span
                            ref={setContainerRef}
                            data-testid="feedback-dialog-content"
                            className={cn(isMultilineMessage && "w-full flex-1 h-full")}
                        />
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter
                    ref={footerRef}
                    className="grid grid-cols-2 gap-2 !space-x-0"
                >
                    {buttons.map((button) => (
                        <AlertDialogAction
                            key={button}
                            onClick={() => handleButtonClick(button)}
                            onKeyDown={handleKeyDown}
                            variant={BUTTON_STYLES[button]}
                            size="md"
                            className={cn(
                                buttons.length === 1 ? "col-span-2" : "col-span-1",
                                "flex-1 uppercase",
                                buttons.length === 3 &&
                                buttonLabels[
                                    button as keyof typeof buttonLabels
                                ]?.toLowerCase() ===
                                DECISION_BUTTON_LABELS.Cancel?.toLowerCase() &&
                                "col-span-2",
                            )}
                        >
                            {buttonLabels[button as keyof typeof buttonLabels]}
                        </AlertDialogAction>
                    ))}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const DEFAULT_DIALOG_STATE = {
    open: false,
    title: "",
    message: "",
    buttons: AlertButtonType,
    buttonLabels: ALERT_BUTTON_LABELS,
    onClose: () => { },
};

// Provider component
export const FeedbackDialogProvider: React.FC<FeedbackDialogProviderProps> = ({
    children,
}) => {
    const [dialogState, setDialogState] =
        useState<DialogState<ButtonType>>(DEFAULT_DIALOG_STATE);

    const alert: ConfirmFunction = useCallback(
        ({ title, content: message, buttonLabels, className }) => {
            return new Promise<void>((resolve) => {
                setDialogState({
                    open: true,
                    title,
                    message: message || "",
                    buttons: AlertButtonType,
                    buttonLabels: buttonLabels || ALERT_BUTTON_LABELS,
                    className,
                    onClose: () => {
                        setDialogState((state) => ({ ...state, open: false }));
                        resolve();
                    },
                });
            });
        },
        [],
    );

    const confirm: ConfirmFunction = useCallback(
        ({ title, content: message, buttonLabels, className }) => {
            return new Promise<boolean>((resolve) => {
                setDialogState({
                    open: true,
                    title,
                    message: message || "",
                    buttons: ConfirmButtonType,
                    buttonLabels: buttonLabels || CONFIRM_BUTTON_LABELS,
                    className,
                    onClose: (button) => {
                        setDialogState((state) => ({ ...state, open: false }));
                        resolve(button === ConfirmButton.Yes);
                    },
                });
            });
        },
        [],
    );

    const decision: ConfirmFunction = useCallback(
        ({ title, content: message, buttonLabels, className }) => {
            return new Promise<boolean | void>((resolve) => {
                setDialogState({
                    open: true,
                    title,
                    message: message || "",
                    buttons: DecisionButtonType,
                    buttonLabels: buttonLabels || DECISION_BUTTON_LABELS,
                    className,
                    onClose: (button) => {
                        setDialogState((state) => ({ ...state, open: false }));
                        if (button === ConfirmButton.Yes) {
                            resolve(true);
                        } else if (button === ConfirmButton.No) {
                            resolve(false);
                        } else {
                            resolve();
                        }
                    },
                });
            });
        },
        [],
    );

    const closeDialog = useCallback(() => {
        setDialogState((state) => ({ ...state, open: false }));
        broadcast.postMessage("CLOSE_DIALOG");
    }, []);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "CLOSE_DIALOG") {
                setDialogState((state) => ({ ...state, open: false }));
            }
        };

        broadcast.addEventListener("message", handleMessage);
        return () => broadcast.removeEventListener("message", handleMessage);
    }, []);

    return (
        <FeedbackDialogContext.Provider
            value={{ alert, confirm, decision, closeDialog }}
        >
            {children}
            <ConfirmDialog {...dialogState} />
        </FeedbackDialogContext.Provider>
    );
};

export const useFeedbackDialog = (): ConfirmContextType => {
    const context = useContext(FeedbackDialogContext);
    if (!context) {
        throw new Error(
            "useFeedbackDialog must be used within a FeedbackDialogProvider",
        );
    }
    return context;
};
