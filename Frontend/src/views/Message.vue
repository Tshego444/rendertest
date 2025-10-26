<!-- Frontend/src/views/Message.vue -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import { useUserStore } from '@/store/user'
import axios from 'axios'
import { useError } from '@/components/useError'
import Spinner from '@/components/Spinner.vue'

/* ───────── basics ───────── */
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const { showError } = useError()
const BACKEND_BASE = import.meta.env.DEV ? 'http://127.0.0.1:3000' : ''

const me = computed(() => userStore.user || { id: null, _id: null, userID: null, name: 'You', email: '' })

/* ───────── state ───────── */
const search = ref('')
const activeConvId = ref(route.params.id ? String(route.params.id) : null)

const convs = ref([])                 // list view (summaries)
const activeConversation = ref(null)  // full conversation (messages array)
const otherUser = ref(null)

const loadingConvs = ref(false)       // used on first load only (poll uses silent mode)
const loadingActive = ref(false)

const startingConv = ref(false)
const sending = ref(false)

const newMessage = ref('')
const messagesContainerRef = ref(null)

let pollTimer = null

/* ───────── helpers ───────── */
function authHeaders () {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}
const url = (p) => `${BACKEND_BASE}${p}`

const safeMessages = computed(() => {
  const c = activeConversation.value
  return c && Array.isArray(c.messages) ? c.messages : []
})

function formatDate (iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Africa/Johannesburg',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}
function shortDate (iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: 'Africa/Johannesburg', month: 'short', day: 'numeric'
    })
  } catch { return iso }
}

/* Identify “other” participant id (db ref first, then legacy id) */
function getOtherIdFromConv (conv, meMongo = null, meLegacy = null) {
  if (!conv) return null
  if (Array.isArray(conv.participantsRef) && conv.participantsRef.length) {
    const refs = conv.participantsRef.map(String)
    const found = meMongo ? refs.find(r => r !== String(meMongo)) : refs[0]
    if (found) return found
  }
  if (Array.isArray(conv.participantsUserID) && conv.participantsUserID.length) {
    const uids = conv.participantsUserID.map(String)
    const found = meLegacy ? uids.find(u => u !== String(meLegacy)) : uids[0]
    if (found) return found
  }
  return null
}

/* ───────── fetchers (list) ───────── */
async function fetchUserForId (idOrUserID) {
  if (!idOrUserID) return null
  try {
    const res = await axios.get(url(`/users/${encodeURIComponent(String(idOrUserID))}`), { headers: authHeaders() })
    return res.data || null
  } catch { return null }
}

async function loadConversations ({ silent = false } = {}) {
  if (!silent) loadingConvs.value = true
  try {
    const res = await axios.get(url('/conversations'), { headers: authHeaders() })
    let list = Array.isArray(res.data) ? res.data : []
    list = list.map(c => ({ ...c, id: String(c.id || c._id || (c._id ? c._id : c.id)) }))

    const meMongo = me.value?.id || me.value?._id || null
    const meLegacy = me.value?.userID || null

    // Prepare a quick lookup by id for in-place updates (so the list doesn’t flash)
    const indexById = new Map(convs.value.map(c => [String(c.id), c]))

    await Promise.all(list.map(async (c) => {
      const otherId = getOtherIdFromConv(c, meMongo, meLegacy)
      if (otherId) {
        const u = await fetchUserForId(otherId)
        c.displayName = (u?.company?.name) || u?.name || u?.email || String(otherId)
      } else {
        c.displayName = c.subject || 'Conversation'
      }
      c.displaySub = c.lastMessage?.text || c.subject || ''
    }))

    // In-place reconcile to avoid replacing the whole array (prevents flashing)
    reconcileList(convs.value, list)
  } catch (err) {
    if (!silent) {
      console.error('Failed to load conversations', err)
      showError(err?.response?.data || err?.message || 'Failed to load conversations')
      convs.value = []
    }
  } finally {
    if (!silent) loadingConvs.value = false
  }
}

/* In-place list reconcile so the left pane doesn’t flash */
function reconcileList (existing, incoming) {
  const byId = new Map(existing.map(i => [String(i.id), i]))
  // update / add
  for (const item of incoming) {
    const id = String(item.id)
    const target = byId.get(id)
    if (target) {
      // update only changed fields
      target.displayName   = item.displayName
      target.displaySub    = item.displaySub
      target.lastMessage   = item.lastMessage
      target.lastMessageAt = item.lastMessageAt
      target.messagesCount = item.messagesCount
    } else {
      existing.push(item)
    }
  }
  // remove missing
  for (let i = existing.length - 1; i >= 0; i--) {
    if (!incoming.find(n => String(n.id) === String(existing[i].id))) {
      existing.splice(i, 1)
    }
  }
  // sort newest first (stable)
  existing.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bt - at
  })
}

/* ───────── open / refresh active conversation ───────── */
async function openConversation (convId, { silent = false } = {}) {
  if (!convId) return
  activeConvId.value = String(convId)
  router.push({ params: { ...route.params, id: convId } }).catch(() => {})

  if (!silent) loadingActive.value = true
  otherUser.value = otherUser.value || null

  try {
    const res = await axios.get(url(`/conversations/${convId}`), { headers: authHeaders() })
    const incoming = res.data || {}
    if (!Array.isArray(incoming.messages)) incoming.messages = []

    // Determine header user once
    if (!otherUser.value) {
      const meMongo = me.value?.id || me.value?._id || null
      const meLegacy = me.value?.userID || null
      const otherId = getOtherIdFromConv(incoming, meMongo, meLegacy)
      if (otherId) {
        const u = await fetchUserForId(otherId)
        otherUser.value = u || { userID: String(otherId) }
      }
    }

    // First time: set object; later: in-place reconcile (no flashing)
    if (!activeConversation.value || String(activeConversation.value.id || activeConversation.value._id) !== String(incoming.id || incoming._id)) {
      activeConversation.value = { ...incoming, messages: [...incoming.messages] }
    } else {
      withPreservedScroll(() => {
        reconcileMessages(activeConversation.value.messages, incoming.messages)
      })
    }

    // mark read in background
    markRead(convId).catch(() => {})
  } catch (err) {
    if (!silent) {
      console.error('Failed to load conversation', err)
      showError(err?.response?.data || err?.message || 'Failed to open conversation')
      activeConversation.value = null
    }
  } finally {
    if (!silent) loadingActive.value = false
  }
}

/* Poll-friendly refresh for active conv */
async function refreshActive ({ silent = true } = {}) {
  if (!activeConvId.value) return
  try {
    const res = await axios.get(url(`/conversations/${activeConvId.value}`), { headers: authHeaders() })
    const incoming = res.data || {}
    if (!Array.isArray(incoming.messages)) incoming.messages = []
    withPreservedScroll(() => {
      reconcileMessages(activeConversation.value?.messages || (activeConversation.value = { id: activeConvId.value, messages: [] }).messages, incoming.messages)
    })
  } catch {
    /* ignore during poll */
  }
}

/* Merge messages in place (no duplicates) */
function reconcileMessages(existing, incoming) {
  // Index current list
  const idToIdx = new Map();
  const sigToIdx = new Map();
  for (let i = 0; i < existing.length; i++) {
    const ex = existing[i];
    const exId = String(ex._id || ex.id || '');
    if (exId) idToIdx.set(exId, i);
    sigToIdx.set(softSig(ex), i);
  }

  for (const msg of incoming) {
    const inId = String(msg._id || msg.id || '');
    const inSig = softSig(msg);

    if (inId && idToIdx.has(inId)) {
      // exact id match → update mutable fields
      const idx = idToIdx.get(inId);
      const t = existing[idx];
      t.read = msg.read;
      t.time = msg.time || msg.at || t.time;
      t.text = msg.text ?? t.text;
      continue;
    }

    if (sigToIdx.has(inSig)) {
      // soft match → replace local optimistic copy with server copy
      const idx = sigToIdx.get(inSig);
      existing[idx] = msg;

      // keep indexes consistent for any subsequent matches
      const newId = String(msg._id || msg.id || '');
      if (newId) idToIdx.set(newId, idx);
      sigToIdx.set(inSig, idx);
      continue;
    }

    // truly new message → append
    idToIdx.set(inId || `idx-${existing.length}`, existing.length);
    sigToIdx.set(inSig, existing.length);
    existing.push(msg);
  }

  // keep chronological order
  existing.sort((a, b) => new Date(a.time || a.at || 0) - new Date(b.time || b.at || 0));
}

/* soft signature for id-less duplicates */
function authorOf(m) {
  // always prefer the DB ref if present; fall back to legacy userID/senderId
  return String(
    (m && (m.fromRef ?? m.senderRef)) ??
    (m && (m.fromUserID ?? m.senderId)) ??
    ''
  );
}

function softSig(m) {
  const text = String((m?.text || '')).trim().toLowerCase();
  const author = authorOf(m);
  const t = new Date(m?.time || m?.at || 0).getTime() || 0;
  // 10s bucket to absorb tiny clock drift and server processing delay
  const bucket = Math.floor(t / 10000);
  return `${author}|${text}|${bucket}`;
}

/* keep scroll position without jump (no flashing) */
function withPreservedScroll (fn) {
  const el = messagesContainerRef.value
  if (!el) { fn(); return }
  const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 2
  const prev = el.scrollHeight
  fn()
  nextTick(() => {
    if (atBottom) {
      el.scrollTop = el.scrollHeight
    } else {
      const diff = el.scrollHeight - prev
      if (diff > 0) el.scrollTop += diff
    }
  })
}

/* ───────── send / read ───────── */
async function sendMessage () {
  if (!activeConvId.value || !newMessage.value.trim() || sending.value) return
  sending.value = true
  try {
    const payload = { text: newMessage.value.trim() }
    const res = await axios.post(url(`/conversations/${activeConvId.value}/messages`), payload, { headers: authHeaders() })
    const sent = res.data?.msg || res.data?.message || res.data || null

    // locally append once (no waiting for poll)
    withPreservedScroll(() => {
      const arr = activeConversation.value?.messages || (activeConversation.value = { id: activeConvId.value, messages: [] }).messages
      const toAdd = sent && (sent._id || sent.id) ? sent : {
        _id: `local-${Date.now()}`,
        fromUserID: me.value.userID,
        fromRef: me.value.id || me.value._id || undefined,
        text: payload.text,
        time: new Date().toISOString(),
        read: false
      }
      arr.push(toAdd)
      reconcileMessages(arr, []) // normalize order/dedupe if needed
    })

    newMessage.value = ''
    // update list quietly
    loadConversations({ silent: true }).catch(() => {})
  } catch (err) {
    showError(err?.response?.data || err?.message || 'Failed to send message')
  } finally {
    sending.value = false
  }
}

async function markRead (convId) {
  try {
    await axios.post(url(`/conversations/${convId}/mark-read`), {}, { headers: authHeaders() })
    // reflect locally
    safeMessages.value.forEach(m => {
      const toMe =
        (m.toUserID && m.toUserID === me.value.userID) ||
        (m.toRef && String(m.toRef) === String(me.value.id || me.value._id))
      if (toMe) m.read = true
    })
    loadConversations({ silent: true }).catch(() => {})
  } catch { /* ignore during poll */ }
}

/* start conversation (unchanged from your code) */
async function startConversation (targetId, subject = '', initialMessage = '') {
  if (!targetId) return
  if (!me.value || !me.value.userType) { showError('User not loaded'); return }
  if (me.value.userType !== 'employer') { showError('Only employers can start conversations.'); return }
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
    showError(err?.response?.data || err?.message || 'Failed to create conversation')
  } finally { startingConv.value = false }
}

/* UI helpers */
function openChatFromList (c) {
  if (!c || !c.id) return
  openConversation(String(c.id))
}
function myMongoId () { return String(me.value?.id || me.value?._id || '') }
function myUserID () { return me.value?.userID || null }
function isFromMe (m) {
  const fromUID = m?.fromUserID ? String(m.fromUserID) : null
  const fromRef = m?.fromRef ? String(m.fromRef) : null
  const myUID = myUserID()
  const myRef = myMongoId()
  return (fromUID && myUID && fromUID === myUID) || (fromRef && myRef && fromRef === myRef)
}

const conversationTitle = computed(() => {
  const u = otherUser.value || {}
  if (u.company?.name) return u.company.name
  if (u.name && u.userID && String(u.name).trim() && String(u.name) !== String(u.userID)) return u.name
  if (u.name && !u.userID && String(u.name).trim()) return u.name
  if (u.email) return u.email
  return activeConversation.value?.subject || 'Conversation'
})

/* ───────── routing + mount ───────── */
watch(() => route.params.id, (val) => {
  activeConvId.value = val ? String(val) : null
  if (activeConvId.value) openConversation(activeConvId.value)
})

onMounted(async () => {
  await loadConversations()                                  // initial list
  if (activeConvId.value) await openConversation(activeConvId.value)

  // 1s poll without flashing: silent list refresh + in-place active reconcile
  pollTimer = setInterval(() => {
    loadConversations({ silent: true })
    refreshActive({ silent: true })
  }, 1000)
})

onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })
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
                <div
                  v-for="c in convs.filter(x => {
                    const q = (search || '').toLowerCase()
                    return !q || (c.displayName||'').toLowerCase().includes(q) || (c.displaySub||'').toLowerCase().includes(q)
                  })"
                  :key="c.id"
                  class="border-b border-gray-100 last:border-0"
                >
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
                <div class="text-sm text-slate-500 p-3">No conversations yet... Once an employer sends you message, you will be able to reply.</div>
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
                    {{ otherUser?.email || activeConversation.subject || '' }}
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
                    :key="m._id || m.id || idx"
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
                    @keydown.enter.exact.prevent="sendMessage"
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

/* ───────── Mobile adjustments ───────── */
@media (max-width: 768px) {
  /* stack the columns vertically */
  .grid {
    display: flex;
    flex-direction: column;
  }

  aside.col-span-4 {
    border-right: none;
    border-bottom: 1px solid #f1f1f1;
    padding: 0.75rem 1rem;
  }

  main.col-span-8 {
    padding: 0.75rem 1rem;
  }

  /* adjust heights for smaller screens */
  .h-\[60vh\] {
    height: 65vh;
  }

  /* message bubbles get full width and smaller font */
  .flex.justify-end > div,
  .flex.justify-start > div {
    max-width: 85%;
    font-size: 0.9rem;
  }

  /* composer spacing */
  .mt-3.pt-3.border-t {
    position: sticky;
    bottom: 0;
    background: white;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  /* search bar spacing */
  input[type="search"] {
    font-size: 0.9rem;
    padding: 0.4rem 0.8rem;
  }

  /* send button smaller on phones */
  button.rounded-full.bg-\[var\(--mediumBlue\)\] {
    padding: 0.4rem 0.9rem;
    font-size: 0.9rem;
  }
}
</style>
