<template>
  <div class="card full-width">
    <div class="card-header">
      <span class="card-title">💬 Recent Messages</span>
      <div class="header-actions">
        <input
          v-model="search"
          type="text"
          class="search-input"
          placeholder="Search messages..."
          @input="$emit('search', search)"
        />
        <button class="btn btn-sm" @click="$emit('refresh')">Refresh</button>
      </div>
    </div>
    <div class="card-body">
      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="!messages.length" class="empty-state">No messages found</div>
      <table v-else>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Group</th>
            <th>Sender</th>
            <th>Content</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(msg, index) in messages.slice(0, 50)" :key="index">
            <td class="time">{{ formatDate(msg.created_at) }}</td>
            <td><span class="badge" :class="`badge-${msg.messageType || 'group'}`">{{ msg.messageType || 'group' }}</span></td>
            <td>{{ msg.groupName || '-' }}</td>
            <td>{{ msg.username || 'Unknown' }}</td>
            <td class="message-content">{{ msg.content }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Message } from '@/types'

defineProps<{
  messages: Message[]
  loading: boolean
}>()

defineEmits<{
  refresh: []
  search: [query: string]
}>()

const search = ref('')

function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}
</script>

<style scoped lang="scss">
.card {
  background: white;
  border: 1px solid #CCCCCC;
  border-radius: 6px;
  overflow: hidden;

  &.full-width {
    grid-column: 1 / -1;
  }

  .card-header {
    padding: 16px;
    border-bottom: 1px solid #CCCCCC;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      font-size: 16px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;

      .search-input {
        width: 200px;
        padding: 6px 12px;
        border: 1px solid #CCCCCC;
        border-radius: 4px;
        font-size: 14px;

        &:focus {
          outline: none;
          border-color: #FF4500;
        }
      }

      .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
      }
    }
  }

  .card-body {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;

    table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        text-align: left;
        padding: 12px 8px;
        border-bottom: 1px solid #E0E0E0;
      }

      th {
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        color: #666666;
      }

      td {
        font-size: 14px;

        .message-content {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .time {
          font-size: 12px;
          color: #666666;
          font-family: 'JetBrains Mono', monospace;
        }
      }
    }

    .badge {
      &.badge-group {
        background: rgba(59, 130, 246, 0.1);
        color: #3B82F6;
        border: 1px solid #3B82F6;
      }

      &.badge-private {
        background: rgba(139, 92, 246, 0.1);
        color: #8B5CF6;
        border: 1px solid #8B5CF6;
      }

      &.badge-system {
        background: rgba(236, 72, 153, 0.1);
        color: #EC4899;
        border: 1px solid #EC4899;
      }
    }

    .loading, .empty-state {
      padding: 24px;
      text-align: center;
      color: #666666;
    }
  }
}
</style>
