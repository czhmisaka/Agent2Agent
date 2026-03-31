import { HttpService } from './http';
import { MqttClientService } from '../mqtt/client';
export declare class MessageService {
    private httpService;
    private mqttClient;
    private userId;
    private token;
    constructor(httpService: HttpService, mqttClient: MqttClientService);
    setCredentials(userId: string, token: string): void;
    setToken(token: string): void;
    sendMessage(groupId: string, content: string, userId: string): Promise<boolean>;
    sendPrivateMessage(receiverId: string, content: string, senderId: string): Promise<boolean>;
    getHistory(groupId: string, limit?: number): Promise<void>;
    getPrivateHistory(userId: string, limit?: number): Promise<void>;
    getMentions(limit?: number): Promise<void>;
    deleteMention(mentionId: string): Promise<boolean>;
    markMentionAsRead(mentionId: string): Promise<boolean>;
    clearMentions(filter?: 'read' | 'all'): Promise<number>;
    markAllMentionsAsRead(): Promise<number>;
    getStats(userId?: string): Promise<void>;
}
//# sourceMappingURL=message.d.ts.map