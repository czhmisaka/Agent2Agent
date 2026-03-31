"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const chalk_1 = __importDefault(require("chalk"));
class HttpService {
    client;
    token = null;
    constructor() {
        this.client = axios_1.default.create({
            baseURL: config_1.httpUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // 添加请求拦截器
        this.client.interceptors.request.use((config) => {
            if (this.token) {
                config.headers.Authorization = `Bearer ${this.token}`;
            }
            return config;
        });
        // 添加响应拦截器
        this.client.interceptors.response.use((response) => response, (error) => {
            console.error(chalk_1.default.red('HTTP Error:'), error.message);
            return Promise.reject(error);
        });
    }
    setToken(token) {
        this.token = token;
    }
    clearToken() {
        this.token = null;
    }
    // 用户相关 API
    async register(username, password) {
        try {
            const response = await this.client.post('/api/users/register', {
                username,
                password
            });
            if (response.data.success) {
                this.token = response.data.token;
                console.log(chalk_1.default.green(`✅ Registered successfully as ${username}`));
                return response.data;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Registration failed:'), error.response?.data?.error || error.message);
        }
        return null;
    }
    async login(username, password) {
        try {
            const response = await this.client.post('/api/users/login', {
                username,
                password
            });
            if (response.data.success) {
                this.token = response.data.token;
                console.log(chalk_1.default.green(`✅ Logged in successfully as ${username}`));
                return response.data;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Login failed:'), error.response?.data?.error || error.message);
        }
        return null;
    }
    async getCurrentUser() {
        try {
            const response = await this.client.get('/api/users/me');
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get user info:'), error.message);
        }
        return null;
    }
    async getUsers() {
        try {
            const response = await this.client.get('/api/users');
            const users = response.data;
            console.log(chalk_1.default.yellow('\n👥 Online Users:'));
            users.forEach((user) => {
                const status = user.is_online ? chalk_1.default.green('🟢 Online') : chalk_1.default.gray('⚫ Offline');
                console.log(`  ${status} ${chalk_1.default.cyan(user.username)} ${user.nickname ? `(${user.nickname})` : ''}`);
            });
            console.log();
            return users;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get users:'), error.message);
        }
        return [];
    }
    // 群组相关 API
    async createGroup(name, description) {
        try {
            const response = await this.client.post('/api/groups', {
                name,
                description
            });
            if (response.data.success) {
                console.log(chalk_1.default.green(`✅ Group created: ${name} (ID: ${response.data.groupId})`));
                return response.data;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to create group:'), error.response?.data?.error || error.message);
        }
        return null;
    }
    async getGroups() {
        try {
            const response = await this.client.get('/api/groups');
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get groups:'), error.message);
        }
        return [];
    }
    async getGroupDetails(groupId) {
        try {
            const response = await this.client.get(`/api/groups/${groupId}`);
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get group details:'), error.message);
        }
        return null;
    }
    async getGroupMembers(groupId) {
        try {
            const response = await this.client.get(`/api/groups/${groupId}/members`);
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get members:'), error.message);
        }
        return [];
    }
    async joinGroup(groupId) {
        try {
            const response = await this.client.post(`/api/groups/${groupId}/join`);
            if (response.data.success) {
                console.log(chalk_1.default.green(`✅ Joined group successfully`));
                return response.data;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to join group:'), error.response?.data?.error || error.message);
        }
        return null;
    }
    async leaveGroup(groupId) {
        try {
            const response = await this.client.post(`/api/groups/${groupId}/leave`);
            if (response.data.success) {
                console.log(chalk_1.default.green(`✅ Left group successfully`));
                return response.data;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to leave group:'), error.response?.data?.error || error.message);
        }
        return null;
    }
    // 消息相关 API
    async getGroupMessages(groupId, limit = 50, offset = 0) {
        try {
            const response = await this.client.get(`/api/groups/${groupId}/messages`, {
                params: { limit, offset }
            });
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get messages:'), error.message);
        }
        return [];
    }
    async getPrivateMessages(userId, limit = 50, offset = 0) {
        try {
            const response = await this.client.get(`/api/messages/private/${userId}`, {
                params: { limit, offset }
            });
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get private messages:'), error.message);
        }
        return [];
    }
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return response.data;
        }
        catch (error) {
            return null;
        }
    }
    // 订阅相关 API
    async getSubscriptions() {
        try {
            const response = await this.client.get('/api/subscriptions');
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get subscriptions:'), error.message);
        }
        return [];
    }
    // 提及相关 API
    async getMentions(options) {
        try {
            const params = {};
            if (options?.limit)
                params.limit = options.limit;
            if (options?.offset)
                params.offset = options.offset;
            if (options?.isRead !== undefined)
                params.is_read = options.isRead;
            const response = await this.client.get('/api/mentions', { params });
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get mentions:'), error.message);
        }
        return { mentions: [], total: 0, unreadCount: 0 };
    }
    // 删除单条提及
    async deleteMention(mentionId) {
        try {
            await this.client.delete(`/api/mentions/${mentionId}`);
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to delete mention:'), error.message);
            return false;
        }
    }
    // 批量删除提及
    async deleteMentions(filter = 'read') {
        try {
            const response = await this.client.delete('/api/mentions', {
                params: { filter }
            });
            return response.data.deletedCount || 0;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to delete mentions:'), error.message);
            return 0;
        }
    }
    // 标记单条提及为已读
    async markMentionAsRead(mentionId) {
        try {
            await this.client.put(`/api/mentions/${mentionId}/read`);
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to mark mention as read:'), error.message);
            return false;
        }
    }
    // 全部标记为已读
    async markAllMentionsAsRead() {
        try {
            const response = await this.client.put('/api/mentions/read-all');
            return response.data.updatedCount || 0;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to mark all mentions as read:'), error.message);
            return 0;
        }
    }
    // 统计相关 API
    async getStats(userId) {
        try {
            const url = userId ? `/api/stats/${userId}` : '/api/stats';
            const response = await this.client.get(url);
            return response.data;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to get stats:'), error.message);
        }
        return null;
    }
}
exports.HttpService = HttpService;
//# sourceMappingURL=http.js.map