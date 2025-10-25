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
    // focus input after open (small delay)
    nextTick(() => {
      if (messagesPane.value) messagesPane.value.scrollTop = messagesPane.value.scrollHeight
    })
  }
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(undefined, { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

async function sendMessage() {
  if (!message.value.trim()) return
  sending.value = true

  const userMsg = { role: 'user', content: message.value.trim(), time: new Date().toISOString() }
  msgs.value.push(userMsg)
  const userInput = message.value.trim()
  message.value = ''
  nextTick(() => { if (messagesPane.value) messagesPane.value.scrollTop = messagesPane.value.scrollHeight })

  try {
    const payload = { message: userInput }
    const res = await axios.post('http://localhost:3000/chat', payload) // ✅ correct endpoint
    const reply = res.data?.response || "Sorry, I couldn't produce an answer right now."
    msgs.value.push({ role: 'assistant', content: reply, time: new Date().toISOString() })
    nextTick(() => { if (messagesPane.value) messagesPane.value.scrollTop = messagesPane.value.scrollHeight })
  } catch (err) {
    console.error('AI chat error', err)
    msgs.value.push({ role: 'assistant', content: 'Error: failed to contact AI service.', time: new Date().toISOString() })
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
    <div v-if="open" class="fixed bottom-24 right-6 z-50 w-96 max-h-[70vh] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-full bg-[var(--mediumBlue)] text-white flex items-center justify-center font-semibold">AI</div>
          <div>
            <div class="font-medium">Jobswipe Assistant</div>
            <div class="text-xs text-slate-400">Ask for help using the app</div>
          </div>
        </div>
        <div>
          <button @click="toggleOpen" class="text-slate-500 text-sm cursor-pointer">✕</button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesPane" class="flex-1 p-3 overflow-y-auto space-y-3 bg-white">
        <div v-if="msgs.length === 0" class="text-sm text-slate-400">What can I help you with?</div>

        <div v-for="(m, i) in msgs" :key="i" class="flex" :class="m.role === 'assistant' ? 'justify-start' : 'justify-end'">
          <div :class="m.role === 'assistant' ? 'bg-gray-100 text-slate-800' : 'bg-[var(--mediumBlue)] text-white'" class="max-w-[85%] px-3 py-2 rounded-lg shadow-sm">
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
  </div>
</template>

<style scoped>
/* small override to ensure the floating button is above modals */
</style>