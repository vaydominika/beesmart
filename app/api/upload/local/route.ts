import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 10MB." },
                { status: 400 }
            );
        }

        // Create uploads directory if it doesn't exist
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.name);
        const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
        const uniqueName = `${baseName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

        // Write file
        const bytes = await file.arrayBuffer();
        const filePath = path.join(UPLOAD_DIR, uniqueName);
        await writeFile(filePath, Buffer.from(bytes));

        // Determine file type
        const mimeType = file.type || "";
        let fileType = "OTHER";
        if (mimeType.startsWith("image/")) fileType = "IMAGE";
        else if (mimeType === "application/pdf") fileType = "PDF";
        else if (mimeType.startsWith("video/")) fileType = "VIDEO";
        else if (mimeType.startsWith("audio/")) fileType = "AUDIO";
        else if (
            mimeType.includes("document") ||
            mimeType.includes("word") ||
            mimeType.includes("spreadsheet") ||
            mimeType.includes("presentation")
        )
            fileType = "DOCUMENT";

        return NextResponse.json({
            fileName: file.name,
            fileUrl: `/uploads/${uniqueName}`,
            fileType,
            fileSize: file.size,
        });
    } catch (e) {
        console.error("POST /api/upload/local", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Upload failed" },
            { status: 500 }
        );
    }
}
