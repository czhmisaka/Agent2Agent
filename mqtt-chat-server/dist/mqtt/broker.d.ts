import Aedes from 'aedes';
import { ClientInfo } from '../types';
export declare function startMqttBroker(): Promise<void>;
export declare function getAedes(): Aedes;
export declare function getClientInfo(clientId: string): ClientInfo | undefined;
//# sourceMappingURL=broker.d.ts.map