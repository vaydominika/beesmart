"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { CreateAssignmentModal } from "@/components/classroom/CreateAssignmentModal";
import { CreateTestModal } from "@/components/classroom/CreateTestModal";
import {
    Search, SlidersHorizontal, Pin, MessageCircle,
    FileText, Image, ClipboardList, GraduationCap,
    Calendar, BookOpen, Paperclip, Send, Upload, X,
} from "lucide-react";

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
    author: { id: true; name: string; avatar?: string | null };
    _count: { comments: number; files: number };
    files: PostFile[];
    assignment?: {
        id: string;
        title: string;
        dueDate: string;
        dueTime?: string | null;
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
    PHOTO: <Image className="h-4 w-4" />,
    ASSIGNMENT: <ClipboardList className="h-4 w-4" />,
    TEST: <GraduationCap className="h-4 w-4" />,
    DATE: <Calendar className="h-4 w-4" />,
    COURSE: <BookOpen className="h-4 w-4" />,
    MATERIAL: <Paperclip className="h-4 w-4" />,
};

const POST_TYPE_LABELS: Record<string, string> = {
    TEXT: "Text",
    PHOTO: "Photo",
    ASSIGNMENT: "Assignment",
    TEST: "Test",
    DATE: "Date",
    COURSE: "Course",
    MATERIAL: "Material",
};

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

export function ClassroomFeed({ classroomId, isTeacher }: Props) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [sort, setSort] = useState("newest");
    const [showFilters, setShowFilters] = useState(false);

    // Create post state
    const [newPostContent, setNewPostContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [postFiles, setPostFiles] = useState<{ fileName: string; fileUrl: string; fileType: string; fileSize: number }[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal state
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [testModalOpen, setTestModalOpen] = useState(false);

    // Comment state
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [comments, setComments] = useState<Record<string, Comment[]>>({});
    const [commentText, setCommentText] = useState("");
    const [postingComment, setPostingComment] = useState(false);

    const fetchPosts = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (typeFilter) params.set("type", typeFilter);
            params.set("sort", sort);
            const res = await fetch(`/api/classrooms/${classroomId}/posts?${params}`);
            if (!res.ok) return;
            const data = await res.json();
            setPosts(data.posts);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [classroomId, search, typeFilter, sort]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const handleCreatePost = async () => {
        if (!newPostContent.trim() && postFiles.length === 0) return;
        setPosting(true);
        try {
            const postType = postFiles.some((f) => f.fileType === "IMAGE") ? "PHOTO" : postFiles.length > 0 ? "MATERIAL" : "TEXT";
            const res = await fetch(`/api/classrooms/${classroomId}/posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: postType,
                    content: newPostContent.trim() || null,
                    files: postFiles.length > 0 ? postFiles : undefined,
                }),
            });
            if (!res.ok) {
                toast.error("Failed to create post.");
                return;
            }
            toast.success("Post created!");
            setNewPostContent("");
            setPostFiles([]);
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
                const res = await fetch("/api/upload/local", { method: "POST", body: formData });
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
        return d.toLocaleDateString();
    };

    const getDueDateBadge = (dueDate: string) => {
        const due = new Date(dueDate);
        const now = new Date();
        const diff = due.getTime() - now.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 0) return { text: "Past due", color: "bg-red-500/20 text-red-500" };
        if (hours < 24) return { text: `${hours}h left`, color: "bg-orange-500/20 text-orange-500" };
        const days = Math.floor(hours / 24);
        if (days <= 3) return { text: `${days}d left`, color: "bg-amber-500/20 text-amber-500" };
        return { text: `Due ${due.toLocaleDateString()}`, color: "bg-blue-500/20 text-blue-500" };
    };

    return (
        <div>
            {/* Post creation */}
            <FancyCard className="bg-(--theme-card) p-4 mb-4">
                <div className="flex gap-3">
                    <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Share something with your class..."
                        className="flex-1 bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 outline-none ring-0 focus:ring-2 focus:ring-(--theme-card) min-h-[60px] p-3 resize-none"
                    />
                    <FancyButton
                        onClick={handleCreatePost}
                        disabled={posting || (!newPostContent.trim() && postFiles.length === 0)}
                        className="text-(--theme-text) text-xs font-bold uppercase px-3 self-end"
                    >
                        <Send className="h-4 w-4" />
                    </FancyButton>
                </div>

                {/* Uploaded files preview */}
                {postFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {postFiles.map((f, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 text-xs font-bold text-(--theme-text) opacity-70"
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

                {/* Teacher action toolbar */}
                {isTeacher && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-(--theme-text)/10">
                        <span className="text-[10px] font-bold text-(--theme-text) opacity-30 uppercase mr-1">Create:</span>
                        <button
                            onClick={() => setAssignmentModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-50 hover:opacity-100 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 transition-opacity"
                        >
                            <ClipboardList className="h-3.5 w-3.5" />
                            Assignment
                        </button>
                        <button
                            onClick={() => setTestModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-50 hover:opacity-100 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 transition-opacity"
                        >
                            <GraduationCap className="h-3.5 w-3.5" />
                            Test / Exam
                        </button>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-50 hover:opacity-100 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 transition-opacity cursor-pointer">
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
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-(--theme-text)/10">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-50 hover:opacity-100 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 transition-opacity cursor-pointer">
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
            </FancyCard>

            {/* Search & Filter */}
            <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--theme-text) opacity-40" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search posts..."
                        className="w-full bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 outline-none ring-0 focus:ring-2 focus:ring-(--theme-card) h-10 pl-10 pr-3"
                    />
                </div>
                <FancyButton
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        "text-(--theme-text) text-xs font-bold uppercase px-3",
                        showFilters && "bg-(--theme-card)"
                    )}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                </FancyButton>
            </div>

            {showFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setTypeFilter("")}
                        className={cn(
                            "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                            !typeFilter ? "bg-(--theme-card) text-(--theme-text)" : "bg-(--theme-sidebar) text-(--theme-text) opacity-60"
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
                                typeFilter === key ? "bg-(--theme-card) text-(--theme-text)" : "bg-(--theme-sidebar) text-(--theme-text) opacity-60"
                            )}
                        >
                            {POST_TYPE_ICONS[key]}
                            {label}
                        </button>
                    ))}
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={() => setSort("newest")}
                            className={cn("text-xs font-bold px-3 py-1.5 rounded-lg", sort === "newest" ? "bg-(--theme-card)" : "bg-(--theme-sidebar) opacity-60")}
                        >
                            Newest
                        </button>
                        <button
                            onClick={() => setSort("oldest")}
                            className={cn("text-xs font-bold px-3 py-1.5 rounded-lg", sort === "oldest" ? "bg-(--theme-card)" : "bg-(--theme-sidebar) opacity-60")}
                        >
                            Oldest
                        </button>
                    </div>
                </div>
            )}

            {/* Posts */}
            {loading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
            ) : posts.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-sm text-(--theme-text) opacity-50">No posts yet. Be the first to share!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <FancyCard key={post.id} className="bg-(--theme-card) p-4">
                            {/* Post Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-(--theme-sidebar) flex items-center justify-center text-xs font-bold text-(--theme-text)">
                                        {post.author.name?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-(--theme-text)">{post.author.name}</span>
                                        <span className="text-xs text-(--theme-text) opacity-40 ml-2">{formatDate(post.createdAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {post.type !== "TEXT" && (
                                        <span className="flex items-center gap-1 text-xs font-bold text-(--theme-text) opacity-50 bg-(--theme-sidebar) px-2 py-0.5 rounded-md">
                                            {POST_TYPE_ICONS[post.type]}
                                            {POST_TYPE_LABELS[post.type]}
                                        </span>
                                    )}
                                    {post.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                                    {isTeacher && (
                                        <button
                                            onClick={() => handleTogglePin(post.id, post.isPinned)}
                                            className="text-xs text-(--theme-text) opacity-40 hover:opacity-100 p-1"
                                            title={post.isPinned ? "Unpin" : "Pin"}
                                        >
                                            <Pin className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Post Title */}
                            {post.title && (
                                <h3 className="text-base font-bold text-(--theme-text) mb-1">{post.title}</h3>
                            )}

                            {/* Post Content */}
                            {post.content && (
                                <p className="text-sm text-(--theme-text) opacity-80 whitespace-pre-wrap mb-3">{post.content}</p>
                            )}

                            {/* Assignment Badge */}
                            {post.assignment && (
                                <div className="flex items-center gap-2 mb-3 p-2 bg-(--theme-sidebar) rounded-lg">
                                    <ClipboardList className="h-4 w-4 text-(--theme-text) opacity-60" />
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-(--theme-text)">{post.assignment.title}</span>
                                        {post.assignment.dueDate && (
                                            <span className={cn("text-xs font-bold ml-2 px-2 py-0.5 rounded-md", getDueDateBadge(post.assignment.dueDate).color)}>
                                                {getDueDateBadge(post.assignment.dueDate).text}
                                            </span>
                                        )}
                                    </div>
                                    {post.assignment.maxPoints && (
                                        <span className="text-xs font-bold text-(--theme-text) opacity-50">{post.assignment.maxPoints} pts</span>
                                    )}
                                </div>
                            )}

                            {/* Test Badge */}
                            {post.test && (
                                <div className="flex items-center gap-2 mb-3 p-2 bg-(--theme-sidebar) rounded-lg">
                                    <GraduationCap className="h-4 w-4 text-(--theme-text) opacity-60" />
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-(--theme-text)">{post.test.title}</span>
                                        {post.test.timeLimit && (
                                            <span className="text-xs text-(--theme-text) opacity-50 ml-2">{post.test.timeLimit} min</span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-(--theme-text) opacity-50 uppercase">{post.test.type}</span>
                                </div>
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
                                            className="flex items-center gap-1.5 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 text-xs font-bold text-(--theme-text) opacity-70 hover:opacity-100 transition-opacity"
                                        >
                                            <Paperclip className="h-3 w-3" />
                                            {f.fileName}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Comments Toggle */}
                            <div className="flex items-center gap-3 pt-2 border-t border-(--theme-text)/10">
                                <button
                                    onClick={() => handleToggleComments(post.id)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-50 hover:opacity-100 transition-opacity"
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
                                                <div className="w-6 h-6 rounded-full bg-(--theme-sidebar) flex items-center justify-center text-[10px] font-bold text-(--theme-text) shrink-0 mt-0.5">
                                                    {comment.author.name?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-(--theme-text)">{comment.author.name}</span>
                                                    <span className="text-[10px] text-(--theme-text) opacity-40 ml-1.5">{formatDate(comment.createdAt)}</span>
                                                    <p className="text-xs text-(--theme-text) opacity-70 mt-0.5">{comment.content}</p>
                                                </div>
                                            </div>
                                            {/* Replies */}
                                            {comment.replies?.map((reply) => (
                                                <div key={reply.id} className="ml-8 mt-1.5 flex items-start gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-(--theme-sidebar) flex items-center justify-center text-[9px] font-bold text-(--theme-text) shrink-0 mt-0.5">
                                                        {reply.author.name?.[0]?.toUpperCase() || "?"}
                                                    </div>
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
                                            className="flex-1 bg-(--theme-sidebar) rounded-lg text-xs border-0 outline-none ring-0 focus:ring-1 focus:ring-(--theme-card) h-8 px-3"
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
                        </FancyCard>
                    ))}
                </div>
            )}

            {/* Modals */}
            <CreateAssignmentModal
                open={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                classroomId={classroomId}
                onCreated={fetchPosts}
            />
            <CreateTestModal
                open={testModalOpen}
                onClose={() => setTestModalOpen(false)}
                classroomId={classroomId}
                onCreated={fetchPosts}
            />
        </div>
    );
}
