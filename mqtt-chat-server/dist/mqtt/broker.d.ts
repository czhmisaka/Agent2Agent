import Aedes from 'aedes';
export declare function startMqttBroker(): Promise<void>;
export declare function getAedes(): Aedes;
export declare function getClientInfo(clientId: string): {
    clientId: string;
    userId?: string;
    username?: string;
} | undefined;
//# sourceMappingURL=broker.d.ts.map