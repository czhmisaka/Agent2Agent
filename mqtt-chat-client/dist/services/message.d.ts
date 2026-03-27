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
    sendMessage(groupId: string, content: string, token: string, userId: string): Promise<boolean>;
    sendPrivateMessage(receiverId: string, content: string, token: string, senderId: string): Promise<boolean>;
    getHistory(groupId: string, limit?: number): Promise<void>;
    getPrivateHistory(userId: string, limit?: number): Promise<void>;
}
//# sourceMappingURL=message.d.ts.map