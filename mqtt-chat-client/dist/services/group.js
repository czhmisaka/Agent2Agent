"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupService = void 0;
const chalk_1 = __importDefault(require("chalk"));
class GroupService {
    httpService;
    mqttClient;
    joinedGroups = new Set();
    userId = null;
    token = null;
    constructor(httpService, mqttClient) {
        this.httpService = httpService;
        this.mqttClient = mqttClient;
    }
    setCredentials(userId, token) {
        this.userId = userId;
        this.token = token;
        this.httpService.setToken(token);
    }
    setToken(token) {
        this.token = token;
        this.httpService.setToken(token);
    }
    async createGroup(name, token, userId) {
        this.httpService.setToken(token);
        const result = await this.httpService.createGroup(name);
        if (result && result.success) {
            const groupId = result.groupId;
            this.joinedGroups.add(groupId);
            return groupId;
        }
        return null;
    }
    async joinGroup(groupId, token, userId) {
        this.httpService.setToken(token);
        const result = await this.httpService.joinGroup(groupId);
        if (result && result.success) {
            this.joinedGroups.add(groupId);
            // 通过 MQTT 通知服务器
            await this.mqttClient.publish(`chat/group/${groupId}/join`, {
                type: 'request',
                timestamp: new Date().toISOString(),
                payload: {
                    userId: userId,
                    token: token
                },
                meta: {}
            });
            return true;
        }
        return false;
    }
    async leaveGroup(groupId, token, userId) {
        this.httpService.setToken(token);
        const result = await this.httpService.leaveGroup(groupId);
        if (result && result.success) {
            this.joinedGroups.delete(groupId);
            // 通过 MQTT 通知服务器
            await this.mqttClient.publish(`chat/group/${groupId}/leave`, {
                type: 'request',
                timestamp: new Date().toISOString(),
                payload: {
                    userId: userId,
                    token: token
                },
                meta: {}
            });
            return true;
        }
        return false;
    }
    async listGroups() {
        const groups = await this.httpService.getGroups();
        if (groups.length === 0) {
            console.log(chalk_1.default.yellow('\n📋 You have not joined any groups yet.'));
            console.log(chalk_1.default.gray('  Use /create <groupname> to create a new group'));
            console.log(chalk_1.default.gray('  Or ask someone for a group ID to join\n'));
            return;
        }
        console.log(chalk_1.default.yellow('\n📋 Your Groups:'));
        groups.forEach((group, index) => {
            const roleLabel = group.role === 'owner' ? chalk_1.default.red('👑 Owner') :
                group.role === 'admin' ? chalk_1.default.yellow('🔧 Admin') :
                    chalk_1.default.gray('👤 Member');
            console.log(`  ${index + 1}. ${chalk_1.default.cyan(group.name)} ${roleLabel}`);
            console.log(`     ID: ${chalk_1.default.gray(group.id)}`);
            if (group.description) {
                console.log(`     Description: ${chalk_1.default.gray(group.description)}`);
            }
        });
        console.log();
    }
    async listMembers(groupId) {
        const members = await this.httpService.getGroupMembers(groupId);
        if (members.length === 0) {
            console.log(chalk_1.default.yellow('\n👥 No members in this group'));
            return;
        }
        console.log(chalk_1.default.yellow(`\n👥 Members (${members.length}):`));
        members.forEach((member) => {
            const status = member.is_online ? chalk_1.default.green('🟢') : chalk_1.default.gray('⚫');
            const roleLabel = member.role === 'owner' ? chalk_1.default.red('👑') :
                member.role === 'admin' ? chalk_1.default.yellow('🔧') :
                    chalk_1.default.gray('👤');
            console.log(`  ${status} ${roleLabel} ${chalk_1.default.cyan(member.username)} ${member.nickname ? `(${member.nickname})` : ''}`);
        });
        console.log();
    }
    isGroupJoined(groupId) {
        return this.joinedGroups.has(groupId);
    }
    getJoinedGroups() {
        return Array.from(this.joinedGroups);
    }
    async getSubscriptions() {
        const subscriptions = await this.httpService.getSubscriptions();
        if (!subscriptions || subscriptions.length === 0) {
            console.log(chalk_1.default.yellow('\n📋 You have no subscriptions yet.'));
            console.log(chalk_1.default.gray('  Use /subscribe keyword|topic|user <value> to create one\n'));
            return;
        }
        console.log(chalk_1.default.yellow('\n📋 Your Subscriptions:'));
        subscriptions.forEach((sub, index) => {
            const typeIcon = sub.type === 'keyword' ? '🔑' : sub.type === 'topic' ? '#️⃣' : '👤';
            console.log(`  ${index + 1}. ${typeIcon} ${chalk_1.default.cyan(sub.type)}: ${chalk_1.default.yellow(sub.value)}`);
            if (sub.createdAt) {
                console.log(`     ${chalk_1.default.gray('Created:')} ${chalk_1.default.gray(new Date(sub.createdAt).toLocaleString())}`);
            }
        });
        console.log();
    }
    getTokenFromStorage() {
        // 实际应该从 auth service 获取
        return null;
    }
    getUserIdFromStorage() {
        // 实际应该从 auth service 获取
        return null;
    }
}
exports.GroupService = GroupService;
//# sourceMappingURL=group.js.map