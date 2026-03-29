import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getGroups, createGroup } from '@/services/group'
import { getMessages, sendMessage as apiSendMessage } from '@/services/message'
import { useAuthStore } from './auth'
import type { Group, Message, MessageReaction, ReactionsUpdate } from '@/types'
import mqtt from 'mqtt'

// 可用的表情列表
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢']

export const useChatStore = defineStore('chat', () => {
  // State
  const groups = ref<Group[]>([])
  const currentGroup = ref<Group | null>(null)
  const messages = ref<Message[]>([])
  const mqttClient = ref<mqtt.MqttClient | null>(null)
  const mqttConnected = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  // 存储消息的反应 { messageId: MessageReaction[] }
  const reactions = ref<Record<string, MessageReaction[]>>({})

  // Getters
  const hasGroups = computed(() => groups.value.length > 0)
  const messageCount = computed(() => messages.value.length)

  // Actions
  async function loadGroups() {
    loading.value = true
    error.value = null

    try {
      const response = await getGroups()

      if (Array.isArray(response)) {
        groups.value = response
      } else {
        groups.value = []
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Load groups error'
      groups.value = []
    } finally {
      loading.value = false
    }
  }

  async function createNewGroup(name: string, description: string) {
    loading.value = true
    error.value = null

    try {
      const response = await createGroup(name, description)

      if (response.success) {
        await loadGroups()
        return true
      } else {
        error.value = response.error || 'Create group failed'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Create group error'
      return false
    } finally {
      loading.value = false
    }
  }

  function selectGroup(group: Group) {
    currentGroup.value = group
    messages.value = []
    loadMessages(group.id)
    connectMQTT(group.id)
  }

  async function loadMessages(groupId: string) {
    loading.value = true
    error.value = null

    try {
      const response = await getMessages(groupId)

      if (Array.isArray(response)) {
        messages.value = response
      } else {
        messages.value = []
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Load messages error'
      messages.value = []
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(content: string) {
    const authStore = useAuthStore()

    if (!currentGroup.value || !authStore.user) return false

    const messageData: Message = {
      sender_id: authStore.user.userId,
      username: authStore.user.username,
      content,
      group_id: currentGroup.value.id,
      created_at: new Date().toISOString()
    }

    // 通过 MQTT 发送
    if (mqttClient.value && mqttConnected.value) {
      const topic = `chat/group/${currentGroup.value.id}/message`
      mqttClient.value.publish(topic, JSON.stringify(messageData))
    }

    // 通过 HTTP 保存
    try {
      await apiSendMessage(currentGroup.value.id, messageData)
      return true
    } catch (err) {
      console.error('Save message error:', err)
      return false
    }
  }

  function connectMQTT(groupId: string) {
    const authStore = useAuthStore()

    if (mqttClient.value) {
      mqttClient.value.end({ force: true })
    }

    const wsUrl = 'ws://localhost:8883/mqtt'
    const topic = `chat/group/${groupId}/message`

    mqttClient.value = mqtt.connect(wsUrl, {
      clientId: `mqtt_client_${Date.now()}`,
      username: authStore.user?.username || '',
      password: authStore.token || ''
    })

    mqttClient.value.on('connect', () => {
      console.log('MQTT Connected')
      mqttConnected.value = true

      mqttClient.value?.subscribe(topic, (err) => {
        if (!err) {
          console.log(`Subscribed to ${topic}`)
        }
      })
    })

    mqttClient.value.on('message', (_receivedTopic: string, message: Buffer) => {
      try {
        const msgData = JSON.parse(message.toString())
        // 处理反应更新消息
        if (msgData.type === 'reactions_update') {
          handleReactionsUpdate(msgData as ReactionsUpdate)
        } else {
          addMessage(msgData)
        }
      } catch (err) {
        console.error('Parse message error:', err)
      }
    })

    mqttClient.value.on('error', (err) => {
      console.error('MQTT Error:', err)
      mqttConnected.value = false
    })

    mqttClient.value.on('close', () => {
      console.log('MQTT Disconnected')
      mqttConnected.value = false
    })
  }

  function addMessage(message: Message) {
    // 避免重复添加
    const exists = messages.value.some(
      (msg) =>
        msg.sender_id === message.sender_id &&
        msg.content === message.content &&
        msg.created_at === message.created_at
    )

    if (!exists) {
      messages.value.push(message)
    }
  }

  function disconnectMQTT() {
    if (mqttClient.value) {
      mqttClient.value.end({ force: true })
      mqttClient.value = null
      mqttConnected.value = false
    }
  }

  // 处理反应更新
  function handleReactionsUpdate(update: ReactionsUpdate) {
    const { messageId, reactions: newReactions } = update.payload
    reactions.value[messageId] = newReactions
  }

  // 切换反应（发送反应动作）
  async function toggleReaction(messageId: string, emoji: string) {
    const authStore = useAuthStore()

    if (!currentGroup.value || !authStore.user) return

    const actionPayload = {
      type: 'action',
      action: 'reaction',
      timestamp: new Date().toISOString(),
      payload: {
        messageId,
        emoji
      },
      meta: {
        groupId: currentGroup.value.id
      }
    }

    // 通过 MQTT 发送反应动作
    if (mqttClient.value && mqttConnected.value) {
      const topic = `chat/group/${currentGroup.value.id}/action`
      mqttClient.value.publish(topic, JSON.stringify(actionPayload))
    }
  }

  return {
    groups,
    currentGroup,
    messages,
    mqttConnected,
    loading,
    error,
    reactions,
    hasGroups,
    messageCount,
    loadGroups,
    createNewGroup,
    selectGroup,
    loadMessages,
    sendMessage,
    connectMQTT,
    disconnectMQTT,
    toggleReaction
  }
})
