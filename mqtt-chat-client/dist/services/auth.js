"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const chalk_1 = __importDefault(require("chalk"));
class AuthService {
    httpService;
    userId = null;
    username = null;
    token = null;
    constructor(httpService) {
        this.httpService = httpService;
    }
    async login(username, password) {
        const result = await this.httpService.login(username, password);
        if (result && result.success) {
            this.userId = result.userId;
            this.username = result.username;
            this.token = result.token;
            this.httpService.setToken(this.token);
            // 订阅用户专属主题
            console.log(chalk_1.default.green(`✅ Login successful`));
            return true;
        }
        return false;
    }
    async register(username, password) {
        const result = await this.httpService.register(username, password);
        if (result && result.success) {
            this.userId = result.userId;
            this.username = result.username;
            this.token = result.token;
            this.httpService.setToken(this.token);
            console.log(chalk_1.default.green(`✅ Registration successful`));
            return true;
        }
        return false;
    }
    logout() {
        this.userId = null;
        this.username = null;
        this.token = null;
        this.httpService.clearToken();
        console.log(chalk_1.default.blue('Logged out'));
    }
    getUserId() {
        return this.userId;
    }
    getUsername() {
        return this.username;
    }
    getToken() {
        return this.token;
    }
    isAuthenticated() {
        return this.token !== null;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.js.map