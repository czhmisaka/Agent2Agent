import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, register, logout as apiLogout } from '@/services/auth'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('mqtt_token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.is_admin === 1)

  // Actions
  async function loginUser(username: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const response = await login(username, password)

      if (response.success) {
        user.value = {
          userId: response.userId || '',
          username: response.username || '',
          is_admin: 0
        }
        token.value = response.token || null

        localStorage.setItem('mqtt_token', response.token || '')
        localStorage.setItem('mqtt_user', JSON.stringify(user.value))

        return true
      } else {
        error.value = response.error || 'Login failed'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function registerUser(username: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const response = await register(username, password)

      if (response.success) {
        return true
      } else {
        error.value = response.error || 'Registration failed'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Registration error'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logoutUser() {
    try {
      await apiLogout()
    } catch (_err) {
      // 忽略登出错误
    }

    user.value = null
    token.value = null

    localStorage.removeItem('mqtt_token')
    localStorage.removeItem('mqtt_user')
  }

  function initializeAuth() {
    const savedToken = localStorage.getItem('mqtt_token')
    const savedUser = localStorage.getItem('mqtt_user')

    if (savedToken && savedUser) {
      try {
        user.value = JSON.parse(savedUser)
        token.value = savedToken || null
      } catch (_err) {
        // JSON 解析失败，清除存储
        logoutUser()
      }
    }
  }

  // 初始化
  initializeAuth()

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    loginUser,
    registerUser,
    logoutUser,
    initializeAuth
  }
})
