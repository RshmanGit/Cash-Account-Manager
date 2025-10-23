"use client";

import * as React from "react";

interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onOpenChange(false);
        }
        if (open) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
            <div className="relative z-10 w-full max-w-lg rounded-lg bg-white dark:bg-neutral-900 shadow-lg">
                <div className="p-4 border-b">
                    {title && <h2 className="text-lg font-semibold">{title}</h2>}
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>
                <div className="p-4">{children}</div>
                {footer && <div className="p-4 border-t flex justify-end gap-2">{footer}</div>}
            </div>
        </div>
    );
}


