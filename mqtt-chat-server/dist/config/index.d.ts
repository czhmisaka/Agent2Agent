export declare const generateSecretKey: (length?: number) => string;
export declare const config: {
    mqtt: {
        port: number;
        websocketPort: number;
    };
    http: {
        port: number;
    };
    database: {
        path: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    cors: {
        allowedOrigins: string[];
    };
};
//# sourceMappingURL=index.d.ts.map