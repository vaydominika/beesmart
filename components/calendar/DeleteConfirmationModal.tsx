"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Spinner } from "@/components/ui/spinner";

interface DeleteConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    title?: string;
    description?: string;
}

export function DeleteConfirmationModal({
    open,
    onClose,
    onConfirm,
    isDeleting,
    title = "Delete Event",
    description = "Are you sure you want to delete this event? This action cannot be undone.",
}: DeleteConfirmationModalProps) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-sm border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none [&>button]:hidden">
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <FancyCard className="bg-(--theme-bg) p-6 flex flex-col items-center text-center">
                    <DialogHeader className="mb-4">
                        <h2 className="text-xl font-bold text-(--theme-text) uppercase">
                            {title}
                        </h2>
                    </DialogHeader>
                    <p className="text-sm text-(--theme-text) opacity-80 mb-6">
                        {description}
                    </p>
                    <div className="flex gap-3 w-full">
                        <FancyButton
                            onClick={onClose}
                            className="flex-1 text-(--theme-text) text-sm font-bold uppercase"
                        >
                            Cancel
                        </FancyButton>
                        <FancyButton
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="flex-1 text-(--theme-text) text-sm font-bold uppercase bg-red-400 hover:bg-red-500 border-red-500"
                        >
                            {isDeleting ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Spinner className="w-4 h-4" />
                                    <span>Deleting…</span>
                                </div>
                            ) : (
                                "Delete"
                            )}
                        </FancyButton>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
