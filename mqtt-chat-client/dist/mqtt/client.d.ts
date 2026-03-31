type MessageHandler = (topic: string, message: any) => void;
export interface MqttCredentials {
    username: string;
    password: string;
}
export declare class MqttClientService {
    private client;
    private messageHandlers;
    private credentials;
    connect(credentials?: MqttCredentials): Promise<void>;
    subscribe(topic: string, handler: MessageHandler): void;
    unsubscribe(topic: string, handler?: MessageHandler): void;
    publish(topic: string, message: any, qos?: 0 | 1 | 2): Promise<void>;
    disconnect(): void;
    reconnectWithCredentials(credentials: MqttCredentials): Promise<void>;
    isConnected(): boolean;
    private notifyHandlers;
    private matchTopic;
}
export {};
//# sourceMappingURL=client.d.ts.map