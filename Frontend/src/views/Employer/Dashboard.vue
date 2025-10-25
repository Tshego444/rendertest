<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import JobListing from '@/components/JobListing.vue'
import Navbar from '@/components/Navbar.vue'
import axios from 'axios'
import { useError } from '@/components/useError'

import Spinner from '@/components/Spinner.vue'

// stores / helpers
const router = useRouter()
const userStore = useUserStore()
const { showError } = useError()

// local fallback list (used if jobStore can't be updated directly)
const localJobs = ref([])
const loading = ref(false)

// Helper: get auth headers
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// computed helper to know if we have jobs
const hasJobs = computed(() => Array.isArray(localJobs.value) && localJobs.value.length > 0)

// Main fetch function
async function loadEmployerJobs() {
  loading.value = true
  try {
    const url = '/employer/jobs'
    console.log('Fetching employer jobs from:', url)
    console.log('Using token:', !!(userStore.token || localStorage.getItem('token')))

    const resp = await axios.get(url, { headers: authHeaders() })
    // backend returns array directly
    const jobs = Array.isArray(resp?.data) ? resp.data : (resp?.data?.jobs || [])
    console.log('Employer jobs response:', resp, 'parsed jobs:', jobs)

    localJobs.value = jobs
  } catch (err) {
    console.error('Failed to load employer jobs:', err, err?.response?.data || err?.message)
    const serverMsg = err?.response?.data || err?.response?.statusText || err?.message
    showError(typeof serverMsg === 'string' ? serverMsg : 'Failed to load your job listings')
  } finally {
    loading.value = false
  }
}

// navigation
function openCreate() {
  router.push('/employer/create')
}

onMounted(() => {
  loadEmployerJobs()
})
</script>



<template>
  <Navbar />

  <div class="flex-1 px-4 py-8 sm:px-6 md:px-10 lg:px-16">
    <div class="mx-auto max-w-5xl">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 class="text-3xl font-bold tracking-tight text-text-primary">
          Your Job Listings
        </h2>

        <button
          class="flex btn items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
          @click="openCreate"
        >
          <FontAwesomeIcon icon="plus" class="text-xl" />
          <span class="truncate">Create New Listing</span>
        </button>
      </div>

      <div class="grid gap-6">
        <div v-if="loading">
          <Spinner size="50" color="#000" />
        </div>

        <template v-if="hasJobs">
          <JobListing
            v-for="listing in localJobs"
            :key="listing.jobID || listing._id"
            v-bind="listing"
          />
        </template>

        <div v-else class="rounded-lg border border-dashed border-gray-200 p-8 text-center text-3xl">
          You don't have any job listings yet.
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.btn {
  background-color: var(--mediumBlue);
  cursor: pointer;
}
</style>
