<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useChatStore } from './stores/chat'

const authStore = useAuthStore()
const chatStore = useChatStore()

const isConnecting = ref(false)

onMounted(() => {
  console.log('MQTT Chat Frontend 已加载')
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>📡 MQTT Chat</h1>
      <div class="status">
        <span v-if="authStore.isAuthenticated" class="connected">已连接</span>
        <span v-else class="disconnected">未连接</span>
      </div>
    </header>
    
    <main class="app-main">
      <div v-if="!authStore.isAuthenticated" class="login-section">
        <h2>登录</h2>
        <form @submit.prevent="authStore.login">
          <input v-model="authStore.username" placeholder="用户名" />
          <input v-model="authStore.password" type="password" placeholder="密码" />
          <button type="submit" :disabled="isConnecting">
            {{ isConnecting ? '连接中...' : '登录' }}
          </button>
        </form>
      </div>
      
      <div v-else class="chat-section">
        <div class="sidebar">
          <h3>群组</h3>
          <ul>
            <li v-for="group in chatStore.groups" :key="group.id">
              {{ group.name }}
            </li>
          </ul>
        </div>
        
        <div class="chat-area">
          <div class="messages">
            <div v-for="msg in chatStore.messages" :key="msg.id" class="message">
              <strong>{{ msg.username }}:</strong> {{ msg.content }}
            </div>
          </div>
          
          <div class="input-area">
            <input 
              v-model="chatStore.inputMessage" 
              @keyup.enter="chatStore.sendMessage"
              placeholder="输入消息..."
            />
            <button @click="chatStore.sendMessage">发送</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.app-header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  margin: 0;
  font-size: 24px;
}

.status span {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.status .connected {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.status .disconnected {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

.app-main {
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 24px;
}

.login-section {
  background: white;
  padding: 32px;
  border-radius: 8px;
  max-width: 400px;
  margin: 0 auto;
}

.login-section form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-section input {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
}

.login-section button {
  padding: 12px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.login-section button:hover {
  background: #1976d2;
}

.chat-section {
  display: flex;
  gap: 24px;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  min-height: 600px;
}

.sidebar {
  width: 250px;
  background: #fafafa;
  border-right: 1px solid #e0e0e0;
  padding: 16px;
}

.sidebar h3 {
  margin: 0 0 16px 0;
}

.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar li {
  padding: 12px;
  cursor: pointer;
  border-radius: 4px;
}

.sidebar li:hover {
  background: #e3f2fd;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message {
  padding: 8px;
  margin-bottom: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
}

.input-area input {
  flex: 1;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
}

.input-area button {
  padding: 12px 24px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.input-area button:hover {
  background: #388e3c;
}
</style>
