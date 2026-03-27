type MessageHandler = (topic: string, message: any) => void;
export declare class MqttClientService {
    private client;
    private messageHandlers;
    connect(): Promise<void>;
    subscribe(topic: string, handler: MessageHandler): void;
    unsubscribe(topic: string, handler?: MessageHandler): void;
    publish(topic: string, message: any, qos?: 0 | 1 | 2): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    private notifyHandlers;
    private matchTopic;
}
export {};
//# sourceMappingURL=client.d.ts.map