import { cn } from "@/app/lib/utils";
import "../css/spinner.css";

export default function Spinner({ className }: { className?: string }) {
    return (
        <div
            role="status"
            className={cn("loading-screen", className)}
            style={{ zIndex: 49, width: "100vw", height: "100vh" }}
        >
            <div className="loading-spinner"></div>
        </div>
    );
}
