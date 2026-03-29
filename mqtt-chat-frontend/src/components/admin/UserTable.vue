<template>
  <div class="card">
    <div class="card-header">
      <span class="card-title">👥 Users</span>
      <button class="btn btn-sm" @click="$emit('refresh')">Refresh</button>
    </div>
    <div class="card-body">
      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="!users.length" class="empty-state">No users found</div>
      <table v-else>
        <thead>
          <tr>
            <th>Username</th>
            <th>Status</th>
            <th>Last Login</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.userId">
            <td>{{ user.username }}</td>
            <td>
              <span class="status-dot" :class="user.is_online ? 'online' : 'offline'"></span>
              {{ user.is_online ? 'Online' : 'Offline' }}
            </td>
            <td class="time">{{ user.last_login ? formatDate(user.last_login) : 'Never' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/types'

defineProps<{
  users: User[]
  loading: boolean
}>()

defineEmits<{
  refresh: []
}>()

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

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
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

        .time {
          font-size: 12px;
          color: #666666;
          font-family: 'JetBrains Mono', monospace;
        }
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
