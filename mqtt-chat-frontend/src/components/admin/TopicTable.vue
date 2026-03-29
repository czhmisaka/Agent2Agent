<template>
  <div class="card">
    <div class="card-header">
      <span class="card-title">📋 Active Topics</span>
      <button class="btn btn-sm" @click="$emit('refresh')">Refresh</button>
    </div>
    <div class="card-body">
      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="!topics.length" class="empty-state">No active topics</div>
      <table v-else>
        <thead>
          <tr>
            <th>Topic</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="topic in topics" :key="topic.name">
            <td><span class="topic-name">{{ topic.name }}</span></td>
            <td><span class="badge" :class="`badge-${topic.type}`">{{ topic.type }}</span></td>
            <td>{{ topic.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface Topic {
  name: string
  type: string
  description: string
}

defineProps<{
  topics: Topic[]
  loading: boolean
}>()

defineEmits<{
  refresh: []
}>()
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

        .topic-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
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
