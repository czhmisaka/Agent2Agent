import { HttpService } from './http';
import { MqttClientService } from '../mqtt/client';
export declare class GroupService {
    private httpService;
    private mqttClient;
    private joinedGroups;
    private userId;
    private token;
    constructor(httpService: HttpService, mqttClient: MqttClientService);
    setCredentials(userId: string, token: string): void;
    setToken(token: string): void;
    createGroup(name: string, token: string, userId: string): Promise<string | null>;
    joinGroup(groupId: string, token: string, userId: string): Promise<boolean>;
    leaveGroup(groupId: string, token: string, userId: string): Promise<boolean>;
    listGroups(): Promise<void>;
    listMembers(groupId: string): Promise<void>;
    isGroupJoined(groupId: string): boolean;
    getJoinedGroups(): string[];
    getSubscriptions(): Promise<void>;
    private getTokenFromStorage;
    private getUserIdFromStorage;
}
//# sourceMappingURL=group.d.ts.map