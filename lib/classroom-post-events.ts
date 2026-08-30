type DeletableClassroomPost = {
    id: string;
    assignment?: { id: string } | null;
    test?: { id: string; type: string } | null;
};

export function classroomPostCreatesCalendarEvent(postType: string) {
    return postType === "ASSIGNMENT" || postType === "TEST";
}

export function classroomPostDeleteDetails(classroomId: string, post: DeletableClassroomPost) {
    if (post.assignment) {
        return {
            endpoint: `/api/classrooms/${classroomId}/assignments/${post.assignment.id}`,
            kind: "assignment" as const,
        };
    }
    if (post.test) {
        return {
            endpoint: `/api/classrooms/${classroomId}/tests/${post.test.id}`,
            kind: post.test.type === "EXAM" ? "exam" as const : "test" as const,
        };
    }
    return {
        endpoint: `/api/classrooms/${classroomId}/posts/${post.id}`,
        kind: "post" as const,
    };
}
