"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";

interface EnrollButtonProps {
    courseId: string;
}

export function EnrollButton({ courseId }: EnrollButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleEnroll = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/courses/${courseId}/enroll`, {
                method: "POST",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to enroll");
            }

            toast.success("You’re enrolled. Your course is ready.");

            // Redirect to viewer
            router.push(`/courses/${courseId}/viewer`);
            router.refresh();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "The course could not be opened.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <WorkspaceButton
            type="button"
            variant="primary"
            onClick={handleEnroll}
            disabled={isLoading}
            className="w-full"
        >
            {isLoading ? <LoaderCircle className="animate-spin" /> : <Play />}
            {isLoading ? "Enrolling..." : "Enroll and start"}
        </WorkspaceButton>
    );
}
