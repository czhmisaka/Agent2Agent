export declare class HttpService {
    private client;
    private token;
    constructor();
    setToken(token: string): void;
    clearToken(): void;
    register(username: string, password: string): Promise<any>;
    login(username: string, password: string): Promise<any>;
    getCurrentUser(): Promise<any>;
    getUsers(): Promise<any>;
    createGroup(name: string, description?: string): Promise<any>;
    getGroups(): Promise<any>;
    getGroupDetails(groupId: string): Promise<any>;
    getGroupMembers(groupId: string): Promise<any>;
    joinGroup(groupId: string): Promise<any>;
    leaveGroup(groupId: string): Promise<any>;
    getGroupMessages(groupId: string, limit?: number, offset?: number): Promise<any>;
    getPrivateMessages(userId: string, limit?: number, offset?: number): Promise<any>;
    healthCheck(): Promise<any>;
    getSubscriptions(): Promise<any>;
    getMentions(options?: {
        limit?: number;
        offset?: number;
        isRead?: boolean;
    }): Promise<any>;
    deleteMention(mentionId: string): Promise<boolean>;
    deleteMentions(filter?: 'read' | 'all'): Promise<number>;
    markMentionAsRead(mentionId: string): Promise<boolean>;
    markAllMentionsAsRead(): Promise<number>;
    getStats(userId?: string): Promise<any>;
}
//# sourceMappingURL=http.d.ts.map