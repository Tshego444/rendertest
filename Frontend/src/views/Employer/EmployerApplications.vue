<script setup>
import Navbar from '@/components/Navbar.vue'
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'
import { useUserStore } from '@/store/user'
import axios from 'axios'
import ApplicantRow from '@/components/ApplicantRow.vue' // (not used for actions below, but keep if needed)

const { showError } = useError()
const { showSuccess } = useSuccess()
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// UI state
const position = ref('')
const job = ref(null)
const applicantsDetailed = ref([]) // enriched from server
const loading = ref(true)
const searchTerm = ref('')
const statusFilter = ref('All') // All or specific status
const statusTabs = ['All', 'Submitted', 'Review', 'Interview', 'Hired', 'Rejected']

function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function loadJobFromServer() {
  loading.value = true
  try {
    const jobID = String(route.params.id || '').trim()
    if (!jobID) {
      showError('No job id in URL.')
      router.push('/dashboard')
      return
    }

    // fetch job (for title + employer check)
    const jobResp = await axios.get(`/jobs/${encodeURIComponent(jobID)}`, { headers: authHeaders() })
    job.value = jobResp?.data
    position.value = job.value?.title || ''

    // ownership check - still do local guard
    const currentUserID = userStore.user?.id || userStore.user?._id || userStore.user?.userID
    const isOwner = String(job.value.employerID) === String(currentUserID) || userStore.user?.userType === 'admin' || userStore.user?.role === 'admin'
    if (!isOwner) {
      showError('Unauthorized Access')
      router.push('/dashboard')
      return
    }

    // fetch enriched applicants (server will attach name/email)
    const resp = await axios.get(`/jobs/${encodeURIComponent(jobID)}/applicants`, { headers: authHeaders() })
    // resp.data expected to be array of { userID, userRef, time, status, name, email, skills, resumeUrl, raw }
    applicantsDetailed.value = Array.isArray(resp?.data) ? resp.data.map(a => ({
      ...a,
      // normalize some fields for UI
      appliedAt: a.time || null
    })) : []

  } catch (err) {
    console.error('Failed to load job or applicants from server:', err)
    const serverMsg = err?.response?.data || err?.response?.statusText || err?.message
    showError(typeof serverMsg === 'string' ? serverMsg : 'Failed to load job or applicants.')
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
}

// filter / search computed
const filteredApplicants = computed(() => {
  const q = String(searchTerm.value || '').trim().toLowerCase()
  return applicantsDetailed.value.filter(a => {
    if (statusFilter.value !== 'All' && statusFilter.value !== a.status) return false
    if (!q) return true
    const name = (a.name || '').toString().toLowerCase()
    const email = (a.email || '').toString().toLowerCase()
    return name.includes(q) || email.includes(q)
  })
})

onMounted(() => {
  loadJobFromServer()
})
</script>



<template>
  <div class="relative flex min-h-screen flex-col">
    <Navbar />

    <div class="px-10 py-5 lg:px-40">
      <div class="layout-content-container flex flex-col gap-8">
        <div class="flex flex-wrap justify-between items-center gap-4">
          <div class="flex flex-col gap-2">
            <p class="text-slate-800 tracking-light text-4xl font-bold leading-tight">Applicants</p>
            <p class="text-slate-500 text-base font-normal leading-normal">Review and manage candidates for the position: <span class="font-semibold">{{ position }}</span></p>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <!-- Search & Filters (restored original rounded search look) -->
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="max-w-md w-full">
              <label class="relative block">
                <span class="sr-only">Search applicants</span>
                <span class="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FontAwesomeIcon :icon="['fas','search']" />
                </span>
                <input
                  v-model="searchTerm"
                  class="block w-full rounded-full py-3 pl-10 pr-4 border border-gray-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  placeholder="Search applicants by name or email"
                />
              </label>
            </div>
          </div>

          <!-- Status Tabs -->
          <div class="flex gap-3 flex-wrap">
            <button
              v-for="tab in statusTabs"
              :key="tab"
              @click="statusFilter = tab"
              :class="['h-10 shrink-0 flex items-center justify-center gap-x-2 rounded-lg px-4 text-sm font-medium leading-normal cursor-pointer']"
              :style="statusFilter === tab ? 'background: var(--mediumBlue); color: white' : 'background: #fff'"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <!-- Applicants Table -->
        <!-- Applicants Table -->
        <div class="flex flex-col rounded-2xl bg-white overflow-hidden">
        <!-- This wrapper controls the scrollable area for the table body.
            Change max-h-[60vh] to suit your layout (e.g. 40vh, 50vh, 70vh) -->
        <div class="overflow-x-auto">
            <div class="min-h-[45vh] max-h-[45vh] overflow-y-auto">
            <table class="w-full min-w-min">
                <thead class="border-b border-gray-200">
                <tr class="bg-slate-50">
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-[320px] text-xs font-medium uppercase tracking-wider bg-slate-50">Name</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-[280px] text-xs font-medium uppercase tracking-wider bg-slate-50">Email</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-48 text-xs font-medium uppercase tracking-wider bg-slate-50">Applied</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-40 text-xs font-medium uppercase tracking-wider bg-slate-50">Status</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-auto text-xs font-medium uppercase tracking-wider bg-slate-50">Actions</th>
                </tr>
                </thead>

                <tbody class="divide-y divide-gray-200">
                <tr v-if="loading">
                    <td colspan="5" class="px-6 py-6 text-center text-slate-500">Loading applicants...</td>
                </tr>

                <tr v-else-if="!loading && filteredApplicants.length === 0">
                    <td colspan="5" class="px-6 py-6 text-center text-slate-500">No applicants found.</td>
                </tr>

                <template v-else>
                    <!-- Single loop — each row is a reusable component -->
                    <ApplicantRow
                    v-for="app in filteredApplicants"
                    :key="app.userID"
                    :applicant="app"
                    :jobRole="position"
                    />
                </template>
                </tbody>
            </table>
            </div>
        </div>
        </div>


      </div>
    </div>
  </div>
</template>
