import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'light')

  function setTheme(theme: Theme) {
    currentTheme.value = theme
    localStorage.setItem('theme', theme)
    applyTheme(theme)
  }

  function toggleTheme() {
    const newTheme = currentTheme.value === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  function applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme)
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 初始化主题
  applyTheme(currentTheme.value)

  // 监听主题变化
  watch(currentTheme, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    currentTheme,
    setTheme,
    toggleTheme
  }
})
