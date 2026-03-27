import { HttpService } from './http';
export declare class AuthService {
    private httpService;
    private userId;
    private username;
    private token;
    constructor(httpService: HttpService);
    login(username: string, password: string): Promise<boolean>;
    register(username: string, password: string): Promise<boolean>;
    logout(): void;
    getUserId(): string | null;
    getUsername(): string | null;
    getToken(): string | null;
    isAuthenticated(): boolean;
}
//# sourceMappingURL=auth.d.ts.map