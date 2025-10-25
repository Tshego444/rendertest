import { ref } from 'vue'

// Reactive success message
const successMessage = ref('')
// Timer reference for auto-clear
let timer = null

// Composable for handling success messages
export function useSuccess() {
  // Show success message with optional auto-clear
  function showSuccess(msg, duration = 5000) {
    successMessage.value = msg
    clearTimeout(timer)
    if (duration > 0) {
      timer = setTimeout(() => {
        successMessage.value = ''
      }, duration)
    }
  }

  // Manually clear success message
  function clearSuccess() {
    clearTimeout(timer)
    successMessage.value = ''
  }

  // Expose state and functions
  return { successMessage, showSuccess, clearSuccess }
}
