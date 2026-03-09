"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FancyButton } from "@/components/ui/fancybutton";
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

            toast.success("Successfully enrolled in the course!");

            // Redirect to viewer
            router.push(`/courses/${courseId}/viewer`);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "An error occurred during enrollment");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <FancyButton
            onClick={handleEnroll}
            disabled={isLoading}
            className="w-full bg-black text-white hover:opacity-90 py-6 text-xl font-bold uppercase"
        >
            {isLoading ? "Enrolling..." : "Enroll Now"}
        </FancyButton>
    );
}
