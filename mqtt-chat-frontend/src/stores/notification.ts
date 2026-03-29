import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])

  function add(notification: Omit<Notification, 'id'>) {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      id,
      duration: 3000,
      ...notification
    }

    notifications.value.push(newNotification)

    // 自动移除
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        remove(id)
      }, newNotification.duration)
    }

    return id
  }

  function remove(id: string) {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  function success(title: string, message: string, duration?: number) {
    return add({ type: 'success', title, message, duration })
  }

  function error(title: string, message: string, duration?: number) {
    return add({ type: 'error', title, message, duration: duration || 5000 })
  }

  function warning(title: string, message: string, duration?: number) {
    return add({ type: 'warning', title, message, duration })
  }

  function info(title: string, message: string, duration?: number) {
    return add({ type: 'info', title, message, duration })
  }

  function clear() {
    notifications.value = []
  }

  return {
    notifications,
    add,
    remove,
    success,
    error,
    warning,
    info,
    clear
  }
})
