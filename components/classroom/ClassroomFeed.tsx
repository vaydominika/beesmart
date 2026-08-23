"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton, workspaceButtonVariants } from "@/components/ui/workspace-button";
import { cn } from "@/lib/utils";
import { formatDateYmd } from "@/lib/date";
import { CreateAssignmentModal } from "@/components/classroom/CreateAssignmentModal";
import { CreateTestModal } from "@/components/classroom/CreateTestModal";
import { CoursePostModal, type PostCourse } from "@/components/classroom/CoursePostModal";
import {
    Search, SlidersHorizontal, Pin, MessageCircle,
    FileText, Image as ImageIcon, ClipboardList, GraduationCap,
    BookOpen, Paperclip, Send, Upload, X, ArrowRight,
    MoreHorizontal, Pencil, Trash2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Editor } from "@/components/ui/editor";
import type { AssignmentDraft, PostAttachmentFile, TestDraft } from "@/lib/classroom-post-drafts";
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PostFile {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
}

interface Post {
    id: string;
    type: string;
    title?: string | null;
    content?: string | null;
    isPinned: boolean;
    createdAt: string;
    author: { id: string; name: string; avatar?: string | null };
    isOwnPost: boolean;
    _count: { comments: number; files: number };
    files: PostFile[];
    assignment?: {
        id: string;
        title: string;
        deadlineAt: string;
        deadlineTimeZone: string;
        deadlineHasTime: boolean;
        isGraded: boolean;
        maxPoints?: number | null;
        _count: { submissions: number };
    } | null;
    test?: {
        id: string;
        title: string;
        type: string;
        timeLimit?: number | null;
        opensAt?: string | null;
        closesAt?: string | null;
    } | null;
    course?: PostCourse | null;
}

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string; avatar?: string | null };
    replies?: Comment[];
}

const POST_TYPE_ICONS: Record<string, React.ReactNode> = {
    TEXT: <FileText className="h-4 w-4" />,
    PHOTO: <ImageIcon className="h-4 w-4" />,
    ASSIGNMENT: <ClipboardList className="h-4 w-4" />,
    TEST: <GraduationCap className="h-4 w-4" />,
    COURSE: <BookOpen className="h-4 w-4" />,
    MATERIAL: <Paperclip className="h-4 w-4" />,
};

const POST_TYPE_LABELS: Record<string, string> = {
    TEXT: "Text",
    PHOTO: "Photo",
    ASSIGNMENT: "Assignment",
    TEST: "Test / Exam",
    COURSE: "Course",
    MATERIAL: "Material",
};

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

function AuthorAvatar({
    author,
    size,
    className,
}: {
    author: { name: string; avatar?: string | null };
    size: number;
    className: string;
}) {
    return (
        <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-[var(--classroom-surface-muted)]", className)}>
            <Image
                src={author.avatar?.trim() || "/images/default_pfp.jpg"}
                alt={`${author.name}'s profile picture`}
                width={size}
                height={size}
                className="h-full w-full object-cover object-center"
            />
        </div>
    );
}

export function ClassroomFeed({ classroomId, isTeacher }: Props) {
    const searchParams = useSearchParams();
    const focusedPostId = searchParams.get("post");
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [sort, setSort] = useState("newest");
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [initialError, setInitialError] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const focusFetchAttemptedRef = useRef<string | null>(null);
    const focusScrollDoneRef = useRef<string | null>(null);

    // Create post state
    const [newPostContent, setNewPostContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [postFiles, setPostFiles] = useState<PostAttachmentFile[]>([]);
    const [postCourse, setPostCourse] = useState<PostCourse | null>(null);
    const [postAssignment, setPostAssignment] = useState<AssignmentDraft | null>(null);
    const [postTest, setPostTest] = useState<TestDraft | null>(null);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const postEditorRef = useRef<{
        getHTML: () => string;
        commands: { clearContent: () => void };
    } | null>(null);
    const editEditorRef = useRef<{
        getHTML: () => string;
        commands: { clearContent: () => void };
    } | null>(null);

    // Modal state
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [testModalOpen, setTestModalOpen] = useState(false);
    const [courseModalOpen, setCourseModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [editContent, setEditContent] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);
    const [postToDelete, setPostToDelete] = useState<Post | null>(null);
    const [deletingPost, setDeletingPost] = useState(false);

    // Comment state
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [comments, setComments] = useState<Record<string, Comment[]>>({});
    const [commentText, setCommentText] = useState("");
    const [postingComment, setPostingComment] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const fetchPosts = useCallback(async (requestedPage = 1, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setLoadMoreError(false);
        if (!append) setInitialError(false);
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set("search", debouncedSearch);
            if (typeFilter) params.set("type", typeFilter);
            params.set("sort", sort);
            params.set("page", String(requestedPage));
            params.set("limit", "20");
            const res = await fetch(`/api/classrooms/${classroomId}/posts?${params}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPosts((current) => {
                if (!append) return data.posts;
                const byId = new Map(current.map((post) => [post.id, post]));
                for (const post of data.posts as Post[]) byId.set(post.id, post);
                return Array.from(byId.values());
            });
            setPage(data.page);
            setTotal(data.total);
            setHasMore(Boolean(data.hasMore));
        } catch {
            if (append) setLoadMoreError(true);
            else {
                setInitialError(true);
                setPosts([]);
                toast.error("Posts could not be loaded.");
            }
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, [classroomId, debouncedSearch, typeFilter, sort]);

    useEffect(() => {
        void fetchPosts(1, false);
    }, [fetchPosts]);

    useEffect(() => {
        focusFetchAttemptedRef.current = null;
        focusScrollDoneRef.current = null;
    }, [focusedPostId]);

    useEffect(() => {
        if (!focusedPostId || loading) return;
        const hasFocusedPost = posts.some((post) => post.id === focusedPostId);
        if (hasFocusedPost) {
            if (focusScrollDoneRef.current === focusedPostId) return;
            focusScrollDoneRef.current = focusedPostId;
            const frame = window.requestAnimationFrame(() => {
                document.getElementById(`classroom-post-${focusedPostId}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            });
            return () => window.cancelAnimationFrame(frame);
        }
        if (focusFetchAttemptedRef.current === focusedPostId) return;
        focusFetchAttemptedRef.current = focusedPostId;
        void fetch(`/api/classrooms/${classroomId}/posts/${focusedPostId}`)
            .then(async (response) => response.ok ? await response.json() as Post : null)
            .then((post) => {
                if (!post) return;
                setPosts((current) => current.some((item) => item.id === post.id) ? current : [post, ...current]);
            })
            .catch(() => undefined);
    }, [classroomId, focusedPostId, loading, posts]);

    useEffect(() => {
        const target = loadMoreRef.current;
        if (!target || !hasMore || loading || loadingMore || loadMoreError) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) void fetchPosts(page + 1, true);
        }, { rootMargin: "240px" });
        observer.observe(target);
        return () => observer.disconnect();
    }, [fetchPosts, hasMore, loadMoreError, loading, loadingMore, page]);

    const handleAddAssignment = (assignment: AssignmentDraft) => {
        setPostAssignment(assignment);
        setPostTest(null);
        setPostCourse(null);
    };

    const handleAddTest = (test: TestDraft) => {
        setPostTest(test);
        setPostAssignment(null);
        setPostCourse(null);
    };

    const handleSelectCourse = (course: PostCourse) => {
        setPostCourse(course);
        setPostAssignment(null);
        setPostTest(null);
    };

    const handleCreatePost = async () => {
        const editorContent = postEditorRef.current?.getHTML() ?? newPostContent;
        const isContentEmpty = !editorContent.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, " ").trim();
        if (isContentEmpty && postFiles.length === 0 && !postCourse && !postAssignment && !postTest) {
            toast.error("Write a message or add something to the post.");
            return;
        }
        setPosting(true);
        try {
            const postType = postTest
                ? "TEST"
                : postAssignment
                    ? "ASSIGNMENT"
                    : postCourse
                        ? "COURSE"
                        : postFiles.some((f) => f.fileType === "IMAGE")
                            ? "PHOTO"
                            : postFiles.length > 0
                                ? "MATERIAL"
                                : "TEXT";
            const res = await fetch(`/api/classrooms/${classroomId}/posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: postType,
                    content: isContentEmpty ? null : editorContent,
                    courseId: postCourse?.id,
                    assignment: postAssignment,
                    test: postTest,
                    uploadIds: postFiles.map((file) => file.uploadId),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Failed to create post.");
                return;
            }
            toast.success("Post created!");
            setNewPostContent("");
            postEditorRef.current?.commands.clearContent();
            setPostFiles([]);
            setPostCourse(null);
            setPostAssignment(null);
            setPostTest(null);
            fetchPosts();
        } catch {
            toast.error("Failed to create post.");
        } finally {
            setPosting(false);
        }
    };

    const handlePostFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;
        setUploadingFiles(true);
        try {
            for (const file of Array.from(fileList)) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("purpose", "POST_ATTACHMENT");
                const res = await fetch("/api/uploads", { method: "POST", body: formData });
                if (!res.ok) {
                    toast.error(`Failed to upload ${file.name}`);
                    continue;
                }
                const uploaded = await res.json();
                setPostFiles((prev) => [...prev, uploaded]);
            }
        } catch {
            toast.error("Upload failed.");
        } finally {
            setUploadingFiles(false);
            e.target.value = "";
        }
    };

    const fetchComments = async (postId: string) => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/posts/${postId}/comments`);
            if (!res.ok) return;
            const data = await res.json();
            setComments((prev) => ({ ...prev, [postId]: data }));
        } catch {
            // ignore
        }
    };

    const handleToggleComments = (postId: string) => {
        if (expandedPost === postId) {
            setExpandedPost(null);
        } else {
            setExpandedPost(postId);
            if (!comments[postId]) fetchComments(postId);
        }
    };

    const handleAddComment = async (postId: string) => {
        if (!commentText.trim()) return;
        setPostingComment(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/posts/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: commentText.trim() }),
            });
            if (!res.ok) {
                toast.error("Failed to add comment.");
                return;
            }
            setCommentText("");
            fetchComments(postId);
            // Update comment count
            setPosts((prev) =>
                prev.map((p) =>
                    p.id === postId ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p
                )
            );
        } catch {
            toast.error("Failed to add comment.");
        } finally {
            setPostingComment(false);
        }
    };

    const openPostEditor = (post: Post) => {
        editEditorRef.current = null;
        setEditContent(post.content || "");
        setEditingPost(post);
    };

    const closePostEditor = () => {
        if (savingEdit) return;
        editEditorRef.current = null;
        setEditingPost(null);
        setEditContent("");
    };

    const handleEditPost = async () => {
        if (!editingPost) return;
        const content = editEditorRef.current?.getHTML() ?? editContent;
        const plainText = content.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").trim();
        const hasAttachment = Boolean(
            editingPost.assignment || editingPost.test || editingPost.course || editingPost.files.length,
        );
        if (!plainText && !hasAttachment && !editingPost.title) {
            toast.error("A post without attachments needs text.");
            return;
        }

        setSavingEdit(true);
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/posts/${editingPost.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: plainText ? content : null }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                toast.error(data.error || "Could not update the post.");
                return;
            }
            toast.success("Post updated.");
            editEditorRef.current = null;
            setEditingPost(null);
            setEditContent("");
            fetchPosts();
        } catch {
            toast.error("Could not update the post.");
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeletePost = async () => {
        if (!postToDelete) return;
        setDeletingPost(true);
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/posts/${postToDelete.id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                toast.error(data.error || "Could not delete the post.");
                return;
            }
            setPosts((current) => current.filter((post) => post.id !== postToDelete.id));
            setExpandedPost((current) => current === postToDelete.id ? null : current);
            setPostToDelete(null);
            toast.success("Post deleted.");
        } catch {
            toast.error("Could not delete the post.");
        } finally {
            setDeletingPost(false);
        }
    };

    const handleTogglePin = async (postId: string, currentlyPinned: boolean) => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/posts/${postId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPinned: !currentlyPinned }),
            });
            if (!res.ok) return;
            fetchPosts();
        } catch {
            // ignore
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return formatDateYmd(d);
    };

    const getDueDateBadge = (dueDate: string) => {
        const due = new Date(dueDate);
        const now = new Date();
        const diff = due.getTime() - now.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 0) return { text: "Past due", color: "bg-[var(--app-danger-soft)]0/20 text-[var(--app-danger)]" };
        if (hours < 24) return { text: `${hours}h left`, color: "bg-[var(--app-warning-soft)] text-[var(--app-warning)]" };
        const days = Math.floor(hours / 24);
        if (days <= 3) return { text: `${days}d left`, color: "bg-[var(--app-warning-soft)] text-[var(--app-warning)]" };
        return { text: `Due ${formatDateYmd(due)}`, color: "bg-[var(--app-info-soft)] text-[var(--app-info)]" };
    };

    return (
        <div>
            {/* Post creation */}
            <section className="mb-5 border-b border-[var(--classroom-line)] pb-5" aria-label="Create a post">
                <div className="mb-2">
                    <h2 className="text-sm font-semibold text-[var(--classroom-text)]">Share with the class</h2>
                </div>
                <div className="relative">
                    <Editor
                        initialValue={newPostContent}
                        onChange={setNewPostContent}
                        onReady={(editor) => { postEditorRef.current = editor; }}
                        placeholder="Write an update..."
                        className="min-h-[72px] rounded-xl border border-[var(--classroom-line)] bg-[color-mix(in_srgb,var(--app-surface)_70%,transparent)] p-3 pr-14 text-sm font-normal text-[var(--classroom-text)] outline-none focus-within:border-[var(--classroom-focus-border)] focus-within:ring-2 focus-within:ring-[var(--classroom-focus-ring)]/15 prose prose-sm max-w-none"
                        id="classroom-post"
                    />
                    <WorkspaceButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleCreatePost}
                        disabled={posting || uploadingFiles}
                        aria-label="Publish post"
                        className="absolute bottom-2 right-2"
                    >
                        <Send className="h-5 w-5" />
                    </WorkspaceButton>
                </div>

                {/* Uploaded files preview */}
                {postFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {postFiles.map((f, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 rounded-lg border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-2.5 py-1.5 text-xs font-medium text-[var(--classroom-text-muted)]"
                            >
                                <Paperclip className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{f.fileName}</span>
                                <button onClick={() => setPostFiles((prev) => prev.filter((_, j) => j !== i))} className="hover:opacity-100 opacity-50">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {postAssignment && (
                    <div data-testid="draft-assignment" className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--classroom-accent)">
                            <ClipboardList className="h-4 w-4 text-[var(--classroom-text-muted)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--classroom-text)]">{postAssignment.title}</p>
                            <p className="truncate text-xs text-[var(--classroom-text-muted)]">
                                Assignment · Due {formatDateYmd(postAssignment.dueDate)}
                                {postAssignment.files.length > 0 && ` · ${postAssignment.files.length} file${postAssignment.files.length === 1 ? "" : "s"}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPostAssignment(null)}
                            aria-label={`Remove assignment ${postAssignment.title}`}
                            className="p-1.5 opacity-45 transition-opacity hover:opacity-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {postTest && (
                    <div data-testid="draft-test" className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--classroom-accent)">
                            <GraduationCap className="h-4 w-4 text-[var(--classroom-text-muted)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--classroom-text)]">{postTest.title}</p>
                            <p className="truncate text-xs text-[var(--classroom-text-muted)]">
                                {postTest.type === "EXAM" ? "Exam" : "Test"} · {postTest.questions.length} question{postTest.questions.length === 1 ? "" : "s"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPostTest(null)}
                            aria-label={`Remove ${postTest.type === "EXAM" ? "exam" : "test"} ${postTest.title}`}
                            className="p-1.5 opacity-45 transition-opacity hover:opacity-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {postCourse && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-(--classroom-accent) bg-[var(--app-surface)] p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface)]">
                            <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--classroom-text)]">{postCourse.title}</p>
                            <p className="truncate text-xs text-[var(--classroom-text-muted)]">
                                {postCourse.creator.name} · {postCourse._count?.modules ?? 0} modules
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPostCourse(null)}
                            aria-label={`Remove ${postCourse.title}`}
                            className="p-1.5 opacity-45 hover:opacity-100 transition-opacity"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Teacher action toolbar */}
                {isTeacher && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-xs font-medium text-[var(--classroom-text-muted)]">Add to post</span>
                        <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => setAssignmentModalOpen(true)}>
                            <ClipboardList className="h-3.5 w-3.5" />
                            Assignment
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => setTestModalOpen(true)}>
                            <GraduationCap className="h-3.5 w-3.5" />
                            Test / Exam
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => setCourseModalOpen(true)}>
                            <BookOpen className="h-3.5 w-3.5" />
                            Course
                        </WorkspaceButton>
                        <label className={workspaceButtonVariants({ variant: "primary", size: "compact", className: "cursor-pointer" })}>
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingFiles ? "Uploading…" : "Files"}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handlePostFileUpload}
                                className="hidden"
                                disabled={uploadingFiles}
                            />
                        </label>
                    </div>
                )}

                {/* Student file upload */}
                {!isTeacher && (
                    <div className="mt-3 flex items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--classroom-accent-hover)] bg-(--classroom-accent) px-2.5 py-2 text-xs font-medium text-[var(--classroom-text-muted)] transition-colors hover:bg-(--classroom-accent-hover) hover:text-[var(--classroom-text)]">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingFiles ? "Uploading…" : "Attach Files"}
                            <input
                                type="file"
                                multiple
                                onChange={handlePostFileUpload}
                                className="hidden"
                                disabled={uploadingFiles}
                            />
                        </label>
                    </div>
                )}
            </section>

            {/* Search & Filter */}
            <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--classroom-text-muted)]" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search posts..."
                        className="h-10 w-full rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] pl-10 pr-3 text-sm text-[var(--classroom-text)] outline-none placeholder:text-[var(--classroom-text-faint)] focus:border-[var(--classroom-focus-border)] focus:ring-2 focus:ring-[var(--classroom-focus-ring)]/20"
                    />
                </div>
                <WorkspaceButton type="button" variant={showFilters ? "primary" : "secondary"} size="icon" onClick={() => setShowFilters(!showFilters)} aria-label="Toggle post filters" aria-pressed={showFilters}>
                    <SlidersHorizontal className="h-4 w-4" />
                </WorkspaceButton>
            </div>

            {showFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setTypeFilter("")}
                        className={cn(
                            "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                            !typeFilter ? "border border-[var(--classroom-accent-hover)] bg-(--classroom-accent) text-[var(--classroom-text)]" : "border border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)]"
                        )}
                    >
                        All
                    </button>
                    {Object.entries(POST_TYPE_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTypeFilter(key)}
                            className={cn(
                                "text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                                typeFilter === key ? "border border-[var(--classroom-accent-hover)] bg-(--classroom-accent) text-[var(--classroom-text)]" : "border border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)]"
                            )}
                        >
                            {POST_TYPE_ICONS[key]}
                            {label}
                        </button>
                    ))}
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={() => setSort("newest")}
                            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", sort === "newest" ? "border border-[var(--classroom-accent-hover)] bg-(--classroom-accent)" : "border border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)]")}
                        >
                            Newest
                        </button>
                        <button
                            onClick={() => setSort("oldest")}
                            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", sort === "oldest" ? "border border-[var(--classroom-accent-hover)] bg-(--classroom-accent)" : "border border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)]")}
                        >
                            Oldest
                        </button>
                    </div>
                </div>
            )}

            {/* Posts */}
            {loading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
            ) : initialError ? (
                <div className="py-10 text-center"><p className="text-sm text-[var(--classroom-text-muted)]">The classroom feed could not be loaded.</p><WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void fetchPosts(1, false)} className="mt-3">Retry</WorkspaceButton></div>
            ) : posts.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-sm text-(--theme-text) opacity-50">No posts yet. Be the first to share!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <article id={`classroom-post-${post.id}`} key={post.id} data-testid="classroom-post-card" className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-4 shadow-none target:ring-2 target:ring-[var(--classroom-focus-border)] target:ring-offset-2 md:p-5">
                            {/* Post Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <AuthorAvatar author={post.author} size={32} className="h-8 w-8" />
                                    <div>
                                        <span className="text-sm font-semibold text-[var(--classroom-text)]">{post.author.name}</span>
                                        <span className="ml-2 text-xs text-[var(--classroom-text-muted)]">{formatDate(post.createdAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {post.type !== "TEXT" && (
                                        <span className="flex items-center gap-1 rounded-md bg-(--classroom-accent) px-2 py-1 text-xs font-medium text-[var(--classroom-text-muted)]">
                                            {POST_TYPE_ICONS[post.type]}
                                            {POST_TYPE_LABELS[post.type]}
                                        </span>
                                    )}
                                    {isTeacher ? (
                                        <button
                                            type="button"
                                            onClick={() => handleTogglePin(post.id, post.isPinned)}
                                            aria-label={post.isPinned ? "Unpin post" : "Pin post"}
                                            className={cn(
                                                "p-1 text-xs text-(--theme-text) transition-all hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--theme-text-important) rounded-md",
                                                post.isPinned ? "opacity-100" : "opacity-40",
                                            )}
                                            title={post.isPinned ? "Unpin" : "Pin"}
                                        >
                                            <Pin
                                                className={cn("h-3.5 w-3.5", post.isPinned && "rotate-45 text-[var(--classroom-pin)]")}
                                                style={post.isPinned ? { fill: "var(--classroom-accent)" } : undefined}
                                            />
                                        </button>
                                    ) : post.isPinned ? (
                                        <Pin
                                            className="h-3.5 w-3.5 rotate-45 text-[var(--classroom-pin)]"
                                            style={{ fill: "var(--classroom-accent)" }}
                                            aria-label="Pinned post"
                                        />
                                    ) : null}
                                    {post.isOwnPost && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label="Post actions"
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] hover:text-[var(--classroom-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="classroom-dialog min-w-36 rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-1 shadow-lg"
                                            >
                                                <DropdownMenuItem
                                                    onSelect={() => openPostEditor(post)}
                                                    className="rounded-lg px-2.5 py-2 text-sm text-[var(--classroom-text-muted)] focus:bg-[var(--classroom-surface-muted)]"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onSelect={() => setPostToDelete(post)}
                                                    className="rounded-lg px-2.5 py-2 text-sm focus:bg-[var(--app-danger-soft)]"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            {/* Post Title */}
                            {post.title && (
                                <h3 className="mb-1 text-base font-semibold text-[var(--classroom-text)]">{post.title}</h3>
                            )}

                            {/* Post Content */}
                            {post.content && (
                                <div
                                    className="mb-3 max-w-none text-sm leading-6 text-[var(--classroom-text-muted)] prose prose-sm"
                                    dangerouslySetInnerHTML={{ __html: post.content }}
                                />
                            )}

                            {/* Assignment Badge */}
                            {post.assignment && (
                                <div className="mb-3 flex items-center gap-2 rounded-xl border border-(--classroom-accent) bg-[var(--app-surface)] p-3">
                                        <ClipboardList className="h-5 w-5 text-(--theme-text) opacity-60" />
                                        <div className="flex-1">
                                            <span className="text-sm font-bold text-(--theme-text)">{post.assignment.title}</span>
                                            {post.assignment.deadlineAt && (
                                                <span title={`Deadline set in ${post.assignment.deadlineTimeZone}`} className={cn("text-xs font-bold ml-2 px-2 py-0.5 rounded-md", getDueDateBadge(post.assignment.deadlineAt).color)}>
                                                    {getDueDateBadge(post.assignment.deadlineAt).text}
                                                </span>
                                            )}
                                        </div>
                                        {post.assignment.maxPoints && (
                                            <span className="text-xs font-bold text-(--theme-text) opacity-50 mr-2">{post.assignment.maxPoints} pts</span>
                                        )}
                                </div>
                            )}

                            {/* Test Badge */}
                            {post.test && (
                                <div className="mb-3 flex items-center gap-2 rounded-xl border border-(--classroom-accent) bg-[var(--app-surface)] p-3">
                                        <GraduationCap className="h-5 w-5 text-(--theme-text) opacity-60" />
                                        <div className="flex-1">
                                            <span className="text-sm font-bold text-(--theme-text)">{post.test.title}</span>
                                            {post.test.timeLimit && (
                                                <span className="text-xs text-(--theme-text) opacity-50 ml-2">{post.test.timeLimit} min</span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-(--theme-text) opacity-50 uppercase mr-2">{post.test.type}</span>
                                </div>
                            )}

                            {/* Course Badge */}
                            {post.course && (
                                <Link href={`/courses/${post.course.id}`} className="block">
                                    <div className="group mb-3 flex items-center gap-3 rounded-xl border border-(--classroom-accent) bg-[var(--app-surface)] p-3 transition-colors hover:bg-[var(--classroom-surface-hover)]">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--classroom-accent)">
                                            <BookOpen className="h-5 w-5 text-(--theme-text) opacity-60 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-(--theme-text) truncate">{post.course.title}</p>
                                            <p className="text-[10px] text-(--theme-text) opacity-45 uppercase truncate">
                                                {post.course.creator.name} · {post.course._count?.modules ?? 0} modules
                                            </p>
                                        </div>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--classroom-accent) opacity-0 transition-opacity group-hover:opacity-100">
                                            <ArrowRight className="h-4 w-4 text-(--theme-text)" />
                                        </div>
                                    </div>
                                </Link>
                            )}

                            {/* Files */}
                            {post.files.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {post.files.map((f) => (
                                        <a
                                            key={f.id}
                                            href={f.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 rounded-lg border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-2.5 py-1.5 text-xs font-medium text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-hover)]"
                                        >
                                            <Paperclip className="h-3 w-3" />
                                            {f.fileName}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Comments Toggle */}
                            <div className="flex items-center gap-3 border-t border-[var(--classroom-line)] pt-3">
                                <button
                                    onClick={() => handleToggleComments(post.id)}
                                    className="flex items-center gap-1.5 text-xs font-medium text-[var(--classroom-text-muted)] transition-colors hover:text-[var(--classroom-text)]"
                                >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    {post._count.comments} {post._count.comments === 1 ? "comment" : "comments"}
                                </button>
                            </div>

                            {/* Comments Section */}
                            {expandedPost === post.id && (
                                <div className="mt-3 space-y-2">
                                    {comments[post.id]?.map((comment) => (
                                        <div key={comment.id} className="ml-4">
                                            <div className="flex items-start gap-2">
                                                <AuthorAvatar author={comment.author} size={24} className="mt-0.5 h-6 w-6" />
                                                <div>
                                                    <span className="text-xs font-bold text-(--theme-text)">{comment.author.name}</span>
                                                    <span className="text-[10px] text-(--theme-text) opacity-40 ml-1.5">{formatDate(comment.createdAt)}</span>
                                                    <p className="text-xs text-(--theme-text) opacity-70 mt-0.5">{comment.content}</p>
                                                </div>
                                            </div>
                                            {/* Replies */}
                                            {comment.replies?.map((reply) => (
                                                <div key={reply.id} className="ml-8 mt-1.5 flex items-start gap-2">
                                                    <AuthorAvatar author={reply.author} size={20} className="mt-0.5 h-5 w-5" />
                                                    <div>
                                                        <span className="text-[11px] font-bold text-(--theme-text)">{reply.author.name}</span>
                                                        <span className="text-[10px] text-(--theme-text) opacity-40 ml-1">{formatDate(reply.createdAt)}</span>
                                                        <p className="text-[11px] text-(--theme-text) opacity-70 mt-0.5">{reply.content}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}

                                    {/* Add Comment */}
                                    <div className="flex gap-2 ml-4 mt-2">
                                        <input
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAddComment(post.id);
                                                }
                                            }}
                                            placeholder="Write a comment..."
                                            className="h-9 flex-1 rounded-lg border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 text-xs font-normal text-[var(--classroom-text)] outline-none placeholder:text-[var(--classroom-text-faint)] focus:border-[var(--classroom-focus-border)] focus:ring-2 focus:ring-[var(--classroom-focus-ring)]/20"
                                        />
                                        <button
                                            onClick={() => handleAddComment(post.id)}
                                            disabled={postingComment}
                                            className="text-(--theme-text) opacity-60 hover:opacity-100 p-1"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>
                    ))}
                    <div ref={loadMoreRef} className="flex min-h-12 items-center justify-center py-2" aria-live="polite">
                        {loadingMore ? <><Spinner className="h-5 w-5" /><span className="ml-2 text-xs text-[var(--classroom-text-muted)]">Loading more posts...</span></> : loadMoreError ? <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void fetchPosts(page + 1, true)}>Retry loading posts</WorkspaceButton> : !hasMore && posts.length > 0 ? <span className="text-xs text-[var(--classroom-text-faint)]">You have reached the end · {total} posts</span> : null}
                    </div>
                </div>
            )}

            {/* Modals */}
            <Dialog open={Boolean(editingPost)} onOpenChange={(open) => { if (!open) closePostEditor(); }}>
                <WorkspaceDialogContent mobileSheet={false} className="classroom-dialog max-w-2xl rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-2xl md:p-6">
                    <DialogHeader className="pr-10">
                        <DialogTitle className="text-xl font-semibold text-[var(--classroom-text)]">Edit post</DialogTitle>
                        <DialogDescription className="sr-only">Update the text in your post.</DialogDescription>
                    </DialogHeader>
                    <DialogClose asChild><WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label="Close post editor" className="absolute right-4 top-4"><X className="h-4 w-4" /></WorkspaceButton></DialogClose>
                    {editingPost && (
                        <Editor
                            key={editingPost.id}
                            initialValue={editingPost.content || ""}
                            onChange={setEditContent}
                            onReady={(editor) => { editEditorRef.current = editor; }}
                            placeholder="Write an update..."
                            className="min-h-36 rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] p-3 text-sm font-normal text-[var(--classroom-text)] outline-none focus-within:border-[var(--classroom-focus-border)] focus-within:ring-2 focus-within:ring-[var(--classroom-focus-ring)]/15 prose prose-sm max-w-none"
                            id={`edit-classroom-post-${editingPost.id}`}
                        />
                    )}
                    <div className="flex justify-end gap-2 border-t border-[var(--classroom-line)] pt-4">
                        <WorkspaceButton
                            type="button"
                            variant="secondary"
                            onClick={closePostEditor}
                            disabled={savingEdit}
                        >
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton
                            type="button"
                            variant="primary"
                            onClick={handleEditPost}
                            disabled={savingEdit}
                        >
                            {savingEdit ? "Saving…" : "Save changes"}
                        </WorkspaceButton>
                    </div>
                </WorkspaceDialogContent>
            </Dialog>

            <Dialog open={Boolean(postToDelete)} onOpenChange={(open) => { if (!open && !deletingPost) setPostToDelete(null); }}>
                <WorkspaceDialogContent mobileSheet={false} className="classroom-dialog max-w-sm rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-2xl md:p-6">
                    <DialogHeader className="pr-10">
                        <DialogTitle className="text-xl font-semibold text-[var(--classroom-text)]">Delete post?</DialogTitle>
                        <DialogDescription className="mt-2 text-sm leading-6 text-[var(--classroom-text-muted)]">
                            This removes the post and its comments. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogClose asChild><WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label="Close delete confirmation" className="absolute right-4 top-4"><X className="h-4 w-4" /></WorkspaceButton></DialogClose>
                    <div className="flex justify-end gap-2 pt-2">
                        <WorkspaceButton
                            type="button"
                            variant="secondary"
                            onClick={() => setPostToDelete(null)}
                            disabled={deletingPost}
                        >
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton
                            type="button"
                            variant="danger"
                            onClick={handleDeletePost}
                            disabled={deletingPost}
                        >
                            {deletingPost ? "Deleting…" : "Delete"}
                        </WorkspaceButton>
                    </div>
                </WorkspaceDialogContent>
            </Dialog>

            <CreateAssignmentModal
                open={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                onAdd={handleAddAssignment}
            />
            <CreateTestModal
                open={testModalOpen}
                onClose={() => setTestModalOpen(false)}
                onAdd={handleAddTest}
                classroomId={classroomId}
            />
            <CoursePostModal
                open={courseModalOpen}
                selectedCourseId={postCourse?.id}
                onClose={() => setCourseModalOpen(false)}
                onSelect={handleSelectCourse}
            />
        </div>
    );
}
