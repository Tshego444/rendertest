<script setup>
import { computed, ref } from 'vue'
import { useSuccess } from '@/components/useSuccess'
import { useError } from '@/components/useError'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import axios from 'axios'
import sampleCV from '@/assets/MockCV.pdf'

// Reusable component for showing success messages
const { showSuccess } = useSuccess()
const { showError } = useError()

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const props = defineProps({
  applicant: {
    type: Object,
    required: true
  },
  // optional jobId prop — parent can pass job.jobID when rendering ApplicantRow,
  // otherwise we will fallback to route.params.id
  jobId: {
    type: String,
    required: false
  },

  jobRole: {
    type: String,
    required: true
  }
})

const localStatus = ref(props.applicant.status || 'Submitted')
const showSkills = ref(false)
const applyingStatusChange = ref(false)
const startingConversation = ref(false)


function viewCV() {
  const url = props.applicant.resumeUrl || props.applicant.cv || sampleCV;
  if (!url) {
    showError('No CV available for this applicant.');
    return;
  }
  // If the server returned a relative path like "/uploads/...", ensure it's absolute in new window
  // window.open will accept absolute or relative. Using _blank will open in a new tab.
  window.open(url, '_blank');
}

async function message() {
  // prevent double-clicks
  if (startingConversation.value) return

  const target = getApplicantIdentifier()
  if (!target) {
    showError('Could not determine applicant id to message.')
    return
  }

  // UX guard: client-side check that caller is employer (server will enforce too)
  if (!userStore.user || (userStore.user.userType && userStore.user.userType !== 'employer')) {
    showError('Only employers can start conversations with applicants.')
    return
  }

  startingConversation.value = true
  try {
    // POST to create (or return existing) conversation
    // Note: use relative path so your Vite proxy / axios baseURL works like your other calls.
    const payload = {
      to: target,
      subject: `About your application${ getJobId() ? ` (job ${getJobId()})` : '' }`,
      initialMessage: `Hi ${props.applicant.name || ''}, I'd like to discuss your application for: ${ props.jobRole }.`
    }

    const headers = authHeaders()
    const res = await axios.post('/conversations', payload, { headers })

    const conv = res?.data
    // conv may be the conversation doc, or an object containing id/_id, or something else.
    const convId = conv?._id || conv?.id || conv?.conversationId || (conv && typeof conv === 'string' ? conv : null)

    if (convId) {
      // navigate to conversation view by id
      router.push({ path: `/message/${convId}` }).catch(()=>{})
      return
    }

    // fallback: server may have returned the full conversation object in a nested prop
    // try to find an _id elsewhere in the response
    const foundId = (function tryFindId(o) {
      if (!o || typeof o !== 'object') return null
      if (o._id) return o._id
      for (const k of Object.keys(o)) {
        if (typeof o[k] === 'object') {
          const nested = tryFindId(o[k])
          if (nested) return nested
        }
      }
      return null
    })(conv)

    if (foundId) {
      router.push({ path: `/message/${foundId}` }).catch(()=>{})
      return
    }

    // As a last resort, refresh conversation list and try to find it by participants.
    // This is heavier but rare — the server should normally return the conversation id.
    try {
      const listRes = await axios.get('/conversations', { headers })
      const list = Array.isArray(listRes?.data) ? listRes.data : []
      const meId = userStore.user?.userID || userStore.user?.id || userStore.user?._id
      const candidate = list.find(c => {
        // compare participantsUserID or participantsRef to match applicant
        const pUIDs = c.participantsUserID || []
        const pRefs = (c.participantsRef || []).map(String)
        return pUIDs.includes(String(target)) || pRefs.includes(String(target)) || (meId && (pUIDs.includes(String(meId)) || pRefs.includes(String(meId))))
      })
      if (candidate && candidate.id) {
        router.push({ path: `/message/${candidate.id}` }).catch(()=>{})
        showSuccess('Conversation opened.')
        return
      }
    } catch (e) {
      // ignore list fallback errors
      console.warn('Fallback conversation list lookup failed', e)
    }

    // If we get here we couldn't determine the conv id — still navigate to message route using applicant id (existing UI may handle it)
    router.push({ path: `/message/${target}` }).catch(()=>{})
  } catch (err) {
    console.error('Failed to start conversation:', err)
    const msg = err?.response?.data || err?.message || 'Failed to start conversation'
    showError(typeof msg === 'string' ? msg : 'Failed to start conversation')
  } finally {
    startingConversation.value = false
  }
}

function formatDateISOToLocal(isoString) {
  if (!isoString) return ''
  try {
    const dt = new Date(isoString)
    return dt.toLocaleDateString(undefined, {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (e) {
    return isoString
  }
}

const statusClass = computed(() => {
  const s = (computedStatus.value || '').toString()
  switch (s.toLowerCase()) {
    case 'submitted':
      return 'bg-gray-100 text-slate-800 border-gray-200'
    case 'review':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'interview':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    case 'hired':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-slate-800 border-gray-200'
  }
})

const skillsList = computed(() => {
  const s = props.applicant.skills ?? props.applicant.skillset ?? props.applicant.skillsList ?? props.applicant.skillsArray ?? ''
  if (Array.isArray(s)) return s
  if (typeof s === 'string') return s.split(',').map(x => x.trim()).filter(Boolean)
  return []
})

const computedStatus = computed({
  get: () => localStatus.value,
  set: (v) => { localStatus.value = v }
})

// Build auth headers (uses store token or localStorage fallback)
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Helper: determines the jobId (priority: prop.jobId -> route.params.id)
function getJobId() {
  return props.jobId || route.params.id || null
}

// Determine applicant identifier (prefer userID; fallback to userRef)
function getApplicantIdentifier() {
  // wherever you persisted applicant entries: userID (legacy string) and/or userRef (mongo _id)
  return props.applicant.userID || props.applicant.userRef || props.applicant.userRefId || null
}

// Called when status is changed: send update to backend
async function onStatusChange() {
  // optimistic UI already changed localStatus via v-model. Persist it:
  const jobId = getJobId()
  const applicantId = getApplicantIdentifier()
  if (!jobId || !applicantId) {
    showError('Unable to determine job or applicant id for status update.')
    // (optionally revert)
    return
  }

  // Do nothing if same status
  const newStatus = localStatus.value || 'Submitted'
  if (applyingStatusChange.value) return

  applyingStatusChange.value = true
  try {
    const url = `/jobs/${encodeURIComponent(jobId)}/applicants/${encodeURIComponent(applicantId)}/status`
    const headers = authHeaders()
    const resp = await axios.put(url, { status: newStatus }, { headers })
    // backend will return updated applicant; optionally use it to update local fields
    showSuccess('Status changed successfully')
    // Optionally you can update local name/email if backend returns them:
    if (resp?.data) {
      // resp.data could be updated applicant object
      // but we won't overwrite other props here — parent should re-fetch if needed
    }
  } catch (err) {
    console.error('Failed to update status:', err)
    // revert to previous value if we can read previous from props or server
    // best-effort: set back to props.applicant.status if exists
    localStatus.value = props.applicant.status || 'Submitted'
    const msg = err?.response?.data || err?.message || 'Failed to update status'
    showError(typeof msg === 'string' ? msg : 'Failed to update status')
  } finally {
    applyingStatusChange.value = false
  }
}
</script>


<template>
  <tr>
    <td class="px-6 py-4">
      <div class="flex flex-col">
        <span class="text-slate-800 font-medium">{{ applicant.name }}</span>
        <span class="text-slate-400 text-sm">{{ applicant.company?.name || '' }}</span>
      </div>
    </td>

    <td class="px-6 py-4 text-slate-600">
      {{ applicant.email || '—' }}
    </td>

    <td class="px-6 py-4 text-slate-600">
      {{ formatDateISOToLocal(applicant.time) }}
    </td>

     <!-- Status pill with dynamic background -->
    <td class="px-6 py-4">
      <div>
        <select
          v-model="computedStatus"
          @change="onStatusChange"
          :class="['appearance-none rounded-full px-3 py-1 text-sm font-medium focus:outline-none cursor-pointer', statusClass]"
          aria-label="Change application status"
        >
          <option>Submitted</option>
          <option>Review</option>
          <option>Interview</option>
          <option>Hired</option>
          <option>Rejected</option>
        </select>
      </div>
    </td>

    <td class="px-6 py-4">
      <div class="flex items-center gap-2">
        <button
          @click="viewCV"
          class="px-3 py-2 rounded-md text-sm border border-gray-200 cursor-pointer"
          :disabled="!(applicant.resumeUrl || applicant.raw?.cv || applicant.raw?.resumeUrl)"
        >
          CV
        </button>
        <!-- Skills button + tooltip wrapper -->
        <div
          class="relative"
          @mouseenter="showSkills = true"
          @mouseleave="showSkills = false"
        >
          <button
            @focus="showSkills = true"
            @blur="showSkills = false"
            class="px-3 py-2 rounded-md text-sm border border-gray-200 cursor-pointer"
            aria-haspopup="true"
            :aria-expanded="showSkills ? 'true' : 'false'"
          >
            Skills
          </button>

          <!-- Tooltip / Popover -->
          <transition name="fade">
            <div
              v-if="showSkills"
              class="absolute right-0 mt-2 z-50 w-56 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white p-3 text-sm shadow-lg"
              role="dialog"
              aria-label="Applicant skills"
            >
              <div v-if="skillsList.length">
                <ul class="space-y-2">
                  <li v-for="(s, idx) in skillsList" :key="idx" class="flex items-start gap-2">
                    <span class="inline-block h-2 w-2 mt-2 rounded-full bg-[var(--mediumBlue)]"></span>
                    <span class="break-words">{{ s }}</span>
                  </li>
                </ul>
              </div>
              <div v-else class="text-slate-500">No skills listed.</div>
            </div>
          </transition>
        </div>

        <button @click="message" class="px-3 py-2 rounded-md text-sm border border-gray-200 cursor-pointer">Message</button>
      </div>
    </td>
  </tr>
</template>

<style scoped>
.status {
  background-color: var(--mediumBlue);
  color: #fff;
}

/* small fade for tooltip */
.fade-enter-active,
.fade-leave-active {
  transition: opacity .12s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>