<script setup>
import { ref, nextTick } from 'vue'
import axios from 'axios'
import { useUserStore } from '@/store/user'

const open = ref(false)
const message = ref('')
const msgs = ref([])
const sending = ref(false)
const messagesPane = ref(null)
const userStore = useUserStore()

function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => {
      if (messagesPane.value)
        messagesPane.value.scrollTop = messagesPane.value.scrollHeight
    })
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: 'Africa/Johannesburg',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

async function sendMessage() {
  if (!message.value.trim()) return
  sending.value = true

  const userMsg = {
    role: 'user',
    content: message.value.trim(),
    time: new Date().toISOString()
  }
  msgs.value.push(userMsg)
  const userInput = message.value.trim()
  message.value = ''
  nextTick(() => {
    if (messagesPane.value)
      messagesPane.value.scrollTop = messagesPane.value.scrollHeight
  })

  try {
    const payload = { message: userInput }
    const res = await axios.post(
      'https://jobseekr-acmk.onrender.com/api/chat',
      payload
    )
    const reply =
      res.data?.response || "Sorry, I couldn't produce an answer right now."
    msgs.value.push({
      role: 'assistant',
      content: reply,
      time: new Date().toISOString()
    })
    nextTick(() => {
      if (messagesPane.value)
        messagesPane.value.scrollTop = messagesPane.value.scrollHeight
    })
  } catch (err) {
    console.error('AI chat error', err)
    msgs.value.push({
      role: 'assistant',
      content: 'Error: failed to contact AI service.',
      time: new Date().toISOString()
    })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <!-- Floating button -->
    <button
      @click="toggleOpen"
      aria-label="Open help chat"
      class="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-[var(--mediumBlue)] text-white hover:scale-105 transition-transform cursor-pointer"
    >
      <span v-if="!open" class="text-xl font-bold">?</span>
      <span v-else class="text-sm">Close</span>
    </button>

    <!-- Chat panel -->
    <transition name="slide-up">
      <div
        v-if="open"
        class="fixed z-50 flex flex-col overflow-hidden shadow-xl bg-white
        sm:bottom-24 sm:right-6 sm:w-96 sm:max-h-[75vh] sm:rounded-xl
        bottom-0 right-0 w-full h-full sm:h-auto sm:translate-y-0"
      >
        <!-- Header -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-[var(--mediumBlue)] sm:bg-white">
          <div class="flex items-center gap-3 text-white sm:text-slate-800">
            <div class="h-9 w-9 rounded-full bg-white sm:bg-[var(--mediumBlue)] text-[var(--mediumBlue)] sm:text-white flex items-center justify-center font-semibold">AI</div>
            <div>
              <div class="font-medium">JobSeekr Assistant</div>
              <div class="text-xs opacity-80 sm:text-slate-400">Ask for help using the app</div>
            </div>
          </div>
          <div>
            <button @click="toggleOpen" class="text-white sm:text-slate-500 text-sm cursor-pointer">✕</button>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messagesPane" class="flex-1 p-3 overflow-y-auto space-y-3 bg-white">
          <div v-if="msgs.length === 0" class="text-sm text-slate-400">
            What can I help you with?
          </div>

          <div
            v-for="(m, i) in msgs"
            :key="i"
            class="flex"
            :class="m.role === 'assistant' ? 'justify-start' : 'justify-end'"
          >
            <div
              :class="m.role === 'assistant'
                ? 'bg-gray-100 text-slate-800'
                : 'bg-[var(--mediumBlue)] text-white'"
              class="max-w-[85%] px-3 py-2 rounded-lg shadow-sm"
            >
              <div class="text-sm whitespace-pre-wrap">{{ m.content }}</div>
              <div class="text-xs mt-1 text-slate-400">{{ formatDate(m.time) }}</div>
            </div>
          </div>
        </div>

        <!-- Composer -->
        <div class="px-3 py-2 border-t border-gray-100 bg-white">
          <form @submit.prevent="sendMessage" class="flex gap-2">
            <input
              v-model="message"
              :disabled="sending"
              placeholder="Ask me about this app or an applicant..."
              class="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none"
            />
            <button
              :disabled="!message.trim() || sending"
              class="rounded-full bg-[var(--mediumBlue)] text-white px-4 py-2 disabled:opacity-60 cursor-pointer"
              type="submit"
            >
              <span v-if="sending">Thinking…</span>
              <span v-else>Send</span>
            </button>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Slide-up animation for mobile */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
