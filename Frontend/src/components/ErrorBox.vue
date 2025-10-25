<script setup>
import { watch, ref, onBeforeUnmount } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  duration: { type: Number, default: 1500 },
})

// Emits - Lets parent listen for a "close" event
const emit = defineEmits(['close'])

let rafId = null
let startTs = 0

// Reactive progress percentage
const progress = ref(0)

// Starts the progress bar/timer when a message is shown - Runs until the given duration finishes, then auto-closes.
function startProgress() {
  cancelProgress() // clear previous animation if any

  // If no duration, skip timer
  if (!props.duration || props.duration <= 0) {
    progress.value = 0
    return
  }

  // Initialize
  startTs = performance.now()
  progress.value = 100

  // Recursive animation loop
  function tick(now) {
    const elapsed = now - startTs

    if (elapsed >= props.duration) {
      // Timer finished - close and stop animating
      progress.value = 0
      emit('close')
      cancelProgress()
      return
    }

    // Update remaining percentage
    const pct = Math.max(0, 100 - (elapsed / props.duration) * 100)
    progress.value = pct

    // Request next frame
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)
}

// Cancels any active progress animation.
function cancelProgress() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// Watch for changes in the message prop - If a new message arrives, restart the progress timer. If message is empty, stop.
watch(
  () => props.message,
  (val) => {
    cancelProgress()
    if (!val) {
      return
    }
    if (props.duration > 0) {
      startProgress()
    } else {
      progress.value = 0
    }
  },
)

// Closes the message manually - Resets animation and notifies parent
function close() {
  cancelProgress()
  emit('close')
}

// Cleanup before unmounting component
onBeforeUnmount(() => {
  cancelProgress()
})
</script>

<template>
  <transition name="toast-fade">
    <div
      v-if="message"
      class="fixed top-4 right-4 z-50 max-w-sm w-full"
      aria-live="assertive"
      role="alert"
    >
      <div class="error-box">
        <div class="message">{{ message }}</div>
        <button @click="close" aria-label="Close error" class="close-btn" title="Close">✕</button>

        <!-- progress bar container (bottom) -->
        <div v-if="duration > 0" class="progress-wrap" aria-hidden="true">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.error-box {
  position: relative; 
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #ffffff;
  color: #b91c1c;
  border: 1px solid #e5e7eb;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.06);
  font-size: 0.95rem;
  overflow: hidden;
}

.message {
  flex: 1;
  line-height: 1.2;
  word-break: break-word;
  padding-right: 0.25rem;
}

.close-btn {
  background: transparent;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.95rem;
  color: #b91c1c;
  transition: background-color 0.12s ease;
}

.close-btn:hover {
  cursor: pointer;
  background-color: #f3f4f6;
}

.close-btn:focus {
  outline: 2px solid rgba(185, 28, 28, 0.12);
  outline-offset: 2px;
  border-radius: 0.375rem;
}

.progress-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: transparent;
}

.progress-fill {
  height: 100%;
  background: #ef4444;
  width: 100%;
  transform-origin: left center;
  transition: width 100ms linear;
}
</style>
