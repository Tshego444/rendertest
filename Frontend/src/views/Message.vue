<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import { useUserStore } from '@/store/user'
import axios from 'axios'
import { useError } from '@/components/useError'
import Spinner from '@/components/Spinner.vue'

// app state
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const { showError } = useError()

// Backend base (no external api lib). Change dev host if needed.
const BACKEND_BASE = import.meta.env.DEV ? 'http://127.0.0.1:3000' : ''

// who is "me"
const me = computed(() => userStore.user || { userID: null, name: 'You', email: '' })

// left panel search / selection
const search = ref('')
const activeConvId = ref(route.params.id ? String(route.params.id) : null)

// conversation summaries and active conversation state
const convs = ref([])          // conversation summaries from GET /conversations
const activeConversation = ref(null) // full conversation object (messages array inside)
const otherUser = ref(null)    // display info for other participant
const loadingConvs = ref(false)
const loadingActive = ref(false)
const startingConv = ref(false)
const sending = ref(false)

// new message composer
const newMessage = ref('')
const messagesContainerRef = ref(null)

// helpers
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}
function url(path) {
  // path should start with '/'
  return `${BACKEND_BASE}${path}`
}

// safeMessages: always return an array so template can iterate safely
const safeMessages = computed(() => {
  const conv = activeConversation.value
  if (!conv || !Array.isArray(conv.messages)) return []
  return conv.messages
})

// date helpers
function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
function shortDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { timeZone: 'Africa/Johannesburg', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// helper: given a conversation summary document + my ids, return the other participant id (either ref or legacy id)
function getOtherIdFromConv(conv, meMongo = null, meLegacy = null) {
  if (!conv) return null
  if (Array.isArray(conv.participantsRef) && conv.participantsRef.length) {
    const refs = conv.participantsRef.map(String)
    const found = meMongo ? refs.find(r => String(r) !== String(meMongo)) : refs[0]
    if (found) return found
  }
  if (Array.isArray(conv.participantsUserID) && conv.participantsUserID.length) {
    const uids = conv.participantsUserID.map(String)
    const found = meLegacy ? uids.find(u => String(u) !== String(meLegacy)) : uids[0]
    if (found) return found
  }
  return null
}

// Fetch conversation summaries for current user
async function loadConversations() {
  loadingConvs.value = true
  try {
    const res = await axios.get(url('/conversations'), { headers: authHeaders() })
    let list = Array.isArray(res.data) ? res.data : []

    // normalize id to string for easier comparisons and routing
    list = list.map(c => ({ ...c, id: String(c.id || c._id || (c._id ? c._id : c.id)) }))

    // enrich each conv with a displayName (the OTHER participant's name/company) and displaySub (recent message)
    const meMongo = me.value?.id || me.value?._id || null
    const meLegacy = me.value?.userID || null

    await Promise.all(list.map(async (c) => {
      const otherId = getOtherIdFromConv(c, meMongo, meLegacy)
      if (otherId) {
        const u = await fetchUserForId(otherId)
        if (u) {
          // prefer company.name for employers, otherwise person's name
          c.displayName = (u.company && u.company.name) ? u.company.name : (u.name || u.email || String(otherId))
        } else {
          c.displayName = String(otherId)
        }
      } else {
        c.displayName = c.subject || 'Conversation'
      }
      c.displaySub = c.lastMessage?.text || c.subject || ''
    }))

    convs.value = list
  } catch (err) {
    console.error('Failed to load conversations', err)
    showError(err?.response?.data || err?.message || 'Failed to load conversations')
    convs.value = []
  } finally {
    loadingConvs.value = false
  }
}

// fetch user display info (server route GET /users/:id)
async function fetchUserForId(idOrUserID) {
  if (!idOrUserID) return null
  try {
    const res = await axios.get(url(`/users/${encodeURIComponent(String(idOrUserID))}`), { headers: authHeaders() })
    return res.data || null
  } catch (err) {
    return null
  }
}

// Open a conversation by id and load its messages + other user info
async function openConversation(convId) {
  if (!convId) return
  activeConvId.value = String(convId)
  router.push({ params: { ...route.params, id: convId } }).catch(()=>{})
  loadingActive.value = true
  otherUser.value = null
  try {
    const res = await axios.get(url(`/conversations/${convId}`), { headers: authHeaders() })
    // normalize to ensure messages is an array
    activeConversation.value = res.data || {}
    if (!Array.isArray(activeConversation.value.messages)) activeConversation.value.messages = []

    // determine the "other" participant (prefer ref then legacy userID)
    const conv = activeConversation.value || {}
    const meMongo = me.value?.id || me.value?._id || null
    const meLegacy = me.value?.userID || null

    let otherIdToFetch = null

    if (Array.isArray(conv.participantsRef) && conv.participantsRef.length) {
      const refs = conv.participantsRef.map(String)
      const found = meMongo ? refs.find(r => String(r) !== String(meMongo)) : refs[0]
      if (found) otherIdToFetch = found
    }

    if (!otherIdToFetch && Array.isArray(conv.participantsUserID) && conv.participantsUserID.length) {
      const uids = conv.participantsUserID.map(String)
      const found = meLegacy ? uids.find(u => String(u) !== String(meLegacy)) : uids[0]
      if (found) otherIdToFetch = found
    }

    if (otherIdToFetch) {
      const u = await fetchUserForId(otherIdToFetch)
      if (u) {
        otherUser.value = u
      } else {
        // Don't set the id as the displayed name — keep only the id for internal lookup
        otherUser.value = { userID: String(otherIdToFetch) }
      }
    }

    // mark read
    await markRead(convId)

    // scroll to bottom
    nextTick(() => {
      if (messagesContainerRef.value) messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    })

    // refresh list to reflect new lastMessageAt/read counts
    loadConversations().catch(()=>{})
  } catch (err) {
    console.error('Failed to load conversation', err)
    showError(err?.response?.data || err?.message || 'Failed to open conversation')
    activeConversation.value = null
  } finally {
    loadingActive.value = false
  }
}

// Send a new message in the active conversation
async function sendMessage() {
  if (!activeConvId.value || !newMessage.value.trim()) return
  sending.value = true
  try {
    const payload = { text: newMessage.value.trim() }
    const res = await axios.post(url(`/conversations/${activeConvId.value}/messages`), payload, { headers: authHeaders() })
    const sent = res.data?.msg || res.data?.message || res.data || null
    const localMsg = sent && sent.text ? {
      _id: sent._id || (`local-${Date.now()}`),
      fromUserID: sent.fromUserID || me.value.userID,
      fromRef: sent.fromRef || me.value.id || undefined,
      toUserID: sent.toUserID || undefined,
      toRef: sent.toRef || undefined,
      text: sent.text || payload.text,
      time: sent.time || new Date().toISOString(),
      read: sent.read || false
    } : {
      _id: `local-${Date.now()}`,
      fromUserID: me.value.userID,
      fromRef: me.value.id || undefined,
      text: payload.text,
      time: new Date().toISOString(),
      read: false
    }

    // ensure we have a conv object and messages array to push into
    activeConversation.value = activeConversation.value || { messages: [] }
    if (!Array.isArray(activeConversation.value.messages)) activeConversation.value.messages = []
    activeConversation.value.messages.push(localMsg)

    newMessage.value = ''
    nextTick(() => {
      if (messagesContainerRef.value) messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    })
    loadConversations().catch(()=>{})
  } catch (err) {
    console.error('sendMessage error', err)
    showError(err?.response?.data || err?.message || 'Failed to send message')
  } finally {
    sending.value = false
  }
}

// Mark messages addressed to the caller as read
async function markRead(convId) {
  if (!convId) return
  try {
    await axios.post(url(`/conversations/${convId}/mark-read`), {}, { headers: authHeaders() })
    if (activeConversation.value && Array.isArray(activeConversation.value.messages)) {
      activeConversation.value.messages.forEach(m => {
        if ((m.toUserID && m.toUserID === me.value.userID) || (m.toRef && String(m.toRef) === String(me.value.id || me.value._id))) {
          m.read = true
        }
      })
    }
    loadConversations().catch(()=>{})
  } catch (err) {
    console.warn('markRead failed', err)
  }
}

// Start a new conversation (employer only) convenience helper — uses backend
async function startConversation(targetId, subject = '', initialMessage = '') {
  if (!targetId) return
  if (!me.value || !me.value.userType) {
    showError('User not loaded')
    return
  }
  if (me.value.userType !== 'employer') {
    showError('Only employers can start conversations.')
    return
  }
  startingConv.value = true
  try {
    const payload = { to: targetId, subject, initialMessage }
    const res = await axios.post(url('/conversations'), payload, { headers: authHeaders() })
    const conv = res.data
    const convId = conv._id || conv.id || null
    await loadConversations()
    if (convId) await openConversation(convId)
    else await loadConversations()
  } catch (err) {
    console.error('startConversation failed', err)
    showError(err?.response?.data || err?.message || 'Failed to create conversation')
  } finally {
    startingConv.value = false
  }
}

// UI helper: open chat (from list click)
function openChatFromList(convSummary) {
  if (!convSummary || !convSummary.id) return
  openConversation(String(convSummary.id))
}

// --- add helper near the other helpers ---
function myMongoId() {
  return String(me.value?.id || me.value?._id || '')
}
function myUserID() {
  return me.value?.userID || null
}

function isFromMe(m) {
  if (!m) return false;
  const fromUID = m.fromUserID ? String(m.fromUserID) : null;
  const fromRef = m.fromRef ? String(m.fromRef) : null;
  const myUID = myUserID();
  const myRef = myMongoId();
  if (fromUID && myUID && String(fromUID) === String(myUID)) return true;
  if (fromRef && myRef && String(fromRef) === String(myRef)) return true;
  return false;
}

const conversationTitle = computed(() => {
  const u = otherUser.value || {}
  // prefer company name
  if (u.company && u.company.name) return u.company.name
  // prefer a real name if present and not equal to legacy id
  if (u.name && u.userID && String(u.name).trim() && String(u.name) !== String(u.userID)) return u.name
  if (u.name && !u.userID && String(u.name).trim()) return u.name
  // prefer email
  if (u.email) return u.email
  // Try a look-up from conversation participants (displayName from conv summary is good if present)
  if (activeConversation.value && activeConversation.value.participantsUserID && activeConversation.value.participantsUserID.length) {
    // don't display raw id — just fall back to generic label
    return activeConversation.value.subject || 'Conversation'
  }
  // ultimate fallback
  return activeConversation.value?.subject || 'Conversation'
})

// When route param changes externally, update active conversation
watch(() => route.params.id, (val) => {
  activeConvId.value = val ? String(val) : null
  if (activeConvId.value) openConversation(activeConvId.value)
})

// Auto open route param if present on mount
onMounted(async () => {
  await loadConversations()
  if (activeConvId.value) openConversation(activeConvId.value)
})
</script>

<template>
  <div class="min-h-screen">
    <Navbar />

    <div class="max-w-6xl mx-auto p-6">
      <div class="text-2xl font-semibold mb-4">Messages</div>

      <div class="bg-white rounded-xl shadow-md overflow-hidden">
        <div class="grid grid-cols-12">
          <!-- LEFT: Conversations list -->
          <aside class="col-span-4 border-r border-gray-100 p-4">
            <div class="flex items-center gap-3 mb-4">
              <input
                v-model="search"
                type="search"
                placeholder="Search..."
                class="w-full rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mediumBlue)]"
              />
            </div>

            <div class="h-[60vh] overflow-y-auto">
              <div v-if="loadingConvs" class="p-4 flex items-center justify-center">
                <Spinner size="28" />
              </div>

              <template v-else-if="convs.length">
                <div v-for="c in convs" :key="c.id" class="border-b border-gray-100 last:border-0">
                  <button
                    @click="openChatFromList(c)"
                    class="w-full text-left px-3 py-3 hover:bg-gray-50 flex items-center gap-3"
                    :class="String(activeConvId) === String(c.id) ? 'bg-gray-50' : ''"
                  >
                    <div class="flex-1">
                      <div class="flex justify-between items-start gap-2">
                        <div>
                          <div class="font-medium text-slate-900">
                            {{ c.displayName || (c.subject || (c.lastMessage?.text ? (c.lastMessage.text.length > 40 ? c.lastMessage.text.slice(0,40)+'…' : c.lastMessage.text) : 'Conversation')) }}
                          </div>
                          <div class="text-xs text-slate-500 truncate max-w-[180px]">{{ c.displaySub }}</div>
                        </div>
                        <div class="text-right">
                          <div class="text-xs text-slate-400">{{ shortDate(c.lastMessageAt) }}</div>
                          <div v-if="c.messagesCount > 0" class="mt-1 inline-flex items-center justify-center rounded-full bg-[var(--mediumBlue)] text-white text-xs px-2 py-0.5">
                            {{ c.messagesCount }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="text-sm text-slate-500 p-3">No conversations yet.</div>
              </template>
            </div>
          </aside>

          <!-- RIGHT: active chat -->
          <main class="col-span-8 p-4">
            <div class="flex flex-col h-[60vh]">
              <div class="border-b border-gray-100 pb-3 mb-3">
                <div v-if="activeConversation" class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-semibold">
                      {{ conversationTitle }}
                    </div>
                    <div class="text-xs text-slate-500">
                      <span v-if="safeMessages.length">
                        {{ safeMessages[safeMessages.length - 1].text }}
                      </span>
                      <span v-else>
                        {{ otherUser?.email || activeConversation.subject || '' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="text-slate-600">Select a conversation to view messages</div>
              </div>

              <div ref="messagesContainerRef" class="flex-1 overflow-y-auto px-2 py-3 space-y-4">
                <div v-if="loadingActive" class="p-4 flex items-center justify-center">
                  <Spinner size="28" />
                </div>

                <div v-else-if="safeMessages.length">
                  <div
                    v-for="(m, idx) in safeMessages"
                    :key="m._id || idx"
                    :class="['flex', isFromMe(m) ? 'justify-end' : 'justify-start']"
                  >
                    <div
                      :class="[
                        'max-w-[70%] px-4 py-2 rounded-lg shadow-sm',
                        isFromMe(m) ? 'bg-[var(--mediumBlue)] text-white' : 'bg-gray-100 text-slate-800'
                      ]"
                    >
                      <div class="text-sm break-words">{{ m.text }}</div>
                      <div class="text-xs mt-1" :class="isFromMe(m) ? 'text-slate-300 text-right' : 'text-slate-500'">
                        {{ formatDate(m.time) }}
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="text-slate-400 text-sm">No messages in this conversation.</div>
              </div>

              <!-- composer -->
              <div class="mt-3 pt-3 border-t border-gray-100">
                <div class="flex gap-2">
                  <input
                    v-model="newMessage"
                    :disabled="!activeConversation"
                    @keyup.enter="sendMessage"
                    placeholder="Write a message..."
                    class="flex-1 rounded-full border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--mediumBlue)]"
                  />
                  <button
                    @click="sendMessage"
                    :disabled="!activeConversation || !newMessage.trim() || sending"
                    class="rounded-full bg-[var(--mediumBlue)] text-white px-4 py-2 disabled:opacity-50 cursor-pointer"
                  >
                    <span v-if="sending">Sending…</span>
                    <span v-else>Send</span>
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled { cursor: not-allowed; }
</style>
