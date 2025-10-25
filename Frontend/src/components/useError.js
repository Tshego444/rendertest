import { ref } from 'vue'

// Reactive error message
const errorMessage = ref('')
// Timer reference for auto-clear
let timer = null

// Composable for handling error messages
export function useError() {
  // Show error message with optional auto-clear
  function showError(msg, duration = 5000) {
    errorMessage.value = msg
    clearTimeout(timer)
    if (duration > 0) {
      timer = setTimeout(() => {
        errorMessage.value = ''
      }, duration)
    }
  }

  // Manually clear error message
  function clearError() {
    clearTimeout(timer)
    errorMessage.value = ''
  }

  // Expose state and functions
  return { errorMessage, showError, clearError }
}
