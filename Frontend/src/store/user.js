import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user')) || null // Load user from localStorage or set null
  }),
  actions: {
    // Log in user and save to localStorage
    login(userData) {
      this.user = userData
      localStorage.setItem('user', JSON.stringify(userData))
    },

    // Log out user and clear localStorage
    logout() {
      this.user = null
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    },

    // Track viewed job applications by ID
    viewApplication(id) {
      if (!this.user) return
      if (!Array.isArray(this.user.applicationsViewed)) {
        this.user.applicationsViewed = []
      }
      if (!this.user.applicationsViewed.includes(id)) {
        this.user.applicationsViewed.push(id)
        // localStorage.setItem('user', JSON.stringify(this.user)) // optional persistence
      }
    },
    
    // Remove the last viewed application from history
    removeLastViewed() {
      if (!this.user) return
      if (Array.isArray(this.user.applicationsViewed) && this.user.applicationsViewed.length > 0) {
        this.user.applicationsViewed.pop()
        // localStorage.setItem('user', JSON.stringify(this.user)) // optional persistence
      }
    }
  }
})
