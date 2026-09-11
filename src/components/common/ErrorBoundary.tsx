"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Nội dung tùy chọn hiển thị phía trên thông báo lỗi (vd: tên form đang lỗi). */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Bọc quanh nội dung có thể lỗi lúc render (vd: form động) — chặn lỗi crash làm treo/trắng cả
 * trang, hiện rõ thông báo lỗi cho người dùng thay vì chạy ngầm im lặng (rule mục 51 đặc tả).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary]", this.props.label, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-error-300 bg-error-50 p-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10">
          <p className="font-medium">Đã xảy ra lỗi khi hiển thị {this.props.label ?? "nội dung này"}.</p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-xs">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
