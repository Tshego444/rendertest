<script setup>
import ApplicationCard from '@/components/ApplicationCard.vue'
import Navbar from '@/components/Navbar.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import axios from 'axios'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'

const { showError } = useError()
const { showSuccess } = useSuccess()
const userStore = useUserStore()

// UI state
const loading = ref(false)
const applications = ref([])   // array returned by /me/applications
const filterType = ref('All')

// date formatter
function formatDate(isoString) {
  if (!isoString) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

// build auth headers
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Fetch user's applications from server (robust against different response shapes)
async function fetchMyApplications() {
  loading.value = true;
  try {
    const res = await axios.get('/me/applications', { headers: authHeaders() });

    // DEBUG: inspect exactly what the server returned
    // (useful during development; remove or comment out in production)
    console.log('GET /me/applications response:', res);
    try { console.log('res.data:', JSON.stringify(res.data, null, 2)); } catch(e){ console.log('res.data (non-JSON):', res.data); }

    let payload = res && res.data;

    // Normalize possible server shapes:
    // - an array (ideal): [ ...applications ]
    // - an object wrapper: { applications: [...] } or { data: [...] }
    // - an object representing a single application (coerce to array)
    if (Array.isArray(payload)) {
      // good
    } else if (payload && Array.isArray(payload.applications)) {
      payload = payload.applications;
    } else if (payload && Array.isArray(payload.data)) {
      payload = payload.data;
    } else if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
      // if it's an object that looks like a single app (has jobID/status), coerce to array
      const looksLikeApp = payload.jobID || payload.title || payload.status || payload.rawApplicant;
      payload = looksLikeApp ? [payload] : [];
    } else {
      // anything else -> empty array
      payload = [];
    }

    // Now payload is an array (safe to map)
    applications.value = payload.map(a => ({
      jobID: a.jobID || (a.jobRef ? String(a.jobRef) : ''),
      title: a.title || '',
      company: a.company || '',
      jobType: a.jobType || {},
      status: a.status || 'Submitted',
      appliedAt: a.appliedAt || null,
      raw: a.rawApplicant || a.raw || {}
    }));
  } catch (err) {
    console.error('fetchMyApplications error:', err);
    const msg = err?.response?.data || err.message || 'Failed to load applications';
    showError(msg);
    applications.value = [];
  } finally {
    loading.value = false;
  }
}


// Filter mapping (UI -> actual status strings)
const statusMap = {
  Submit: 'Submitted',
  Review: 'Review',
  Interview: 'Interview',
  Declined: 'Rejected'
}

// Computed filtered list shown in template
const filteredApplications = computed(() => {
  if (!applications.value || filterType.value === 'All') return applications.value

  const selected = statusMap[filterType.value] || filterType.value
  return applications.value.filter(a => String(a.status) === String(selected))
})

// change filter value (used by template buttons)
function select(st) {
  filterType.value = st
}

// Re-fetch when user logs in / changes
watch(
  () => userStore.user,
  (val) => {
    if (val) fetchMyApplications()
    else applications.value = []
  },
  { immediate: true }
)

// initial fetch on mount (in case userStore already has user)
onMounted(() => {
  if (userStore.user) fetchMyApplications()
})
</script>

<template>
  <Navbar />

  <div class="flex flex-1 justify-center px-4 py-8 sm:px-6 md:px-10">
    <div class="w-full max-w-4xl">
      <div class="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h2 class="text-3xl font-bold tracking-tight">My Applications</h2>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none btn"
            @click="select('All')"
            :class="{ selected: filterType === 'All' }"
          >
            All
          </button>
          <button
            class="rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none btn"
            @click="select('Submit')"
            :class="{ selected: filterType === 'Submit' }"
          >
            Submitted
          </button>
          <button
            class="rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none btn"
            @click="select('Review')"
            :class="{ selected: filterType === 'Review' }"
          >
            In Review
          </button>
          <button
            class="rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none btn"
            @click="select('Interview')"
            :class="{ selected: filterType === 'Interview' }"
          >
            Interview
          </button>
          <button
            class="rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none btn"
            @click="select('Declined')"
            :class="{ selected: filterType === 'Declined' }"
          >
            Declined
          </button>
        </div>
      </div>
      <div class="space-y-6">
        <ApplicationCard
          v-for="application in filteredApplications"
          :key="application.jobID"
          :title="application.title"
          :company="application.company"
          :typeOfJob="application.jobType.time"
          :status="application.status"
          :date="formatDate(application.appliedAt)"
        />
      </div>
    </div>
  </div>
</template>


<style scoped>
.btn {
  background-color: #fff;
  color: black;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.selected {
  background-color: var(--mediumBlue);
  color: #fff;
}
</style>
