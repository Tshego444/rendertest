<script setup>
import { useRouter } from 'vue-router'
import { useSuccess } from '@/components/useSuccess'
import { useError } from '@/components/useError'
import { useUserStore } from '@/store/user'
import axios from 'axios'

// Success + Error notifications
const { showSuccess } = useSuccess()
const { showError } = useError()

// User store for token
const userStore = useUserStore()

// Props received from parent with job details
const props = defineProps({
  jobID: { type: String },        // Job unique identifier
  title: { type: String },        // Job title
  description: { type: String },  // Job description
  location: { type: String },     // Job location
  jobType: { type: Object }       // Job type info
})

// Router instance for navigation
const router = useRouter()

// Helper: get auth headers
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Navigate to edit job page
function onEdit() {
  router.push(`/employer/listing/${props.jobID}`)
}

// Remove job and show success message
async function onRemove() {
  // Confirm
  const ok = window.confirm('Are you sure you want to permanently delete this job listing?')
  if (!ok) return

  try {
    const url = `/jobs/${props.jobID}`
    const resp = await axios.delete(url, { headers: authHeaders() })
    console.log('Delete response:', resp?.data)

    showSuccess('Successfully deleted')
    router.go(0)
  } catch (err) {
    console.error('Failed to delete job:', err)
    const serverMsg = err?.response?.data || err?.response?.statusText || err?.message
    showError(typeof serverMsg === 'string' ? serverMsg : 'Failed to delete job')
  }
}

// Navigate to job applications page
function showApplications() {
  router.push(`/employer/applications/${props.jobID}`)
}
</script>


<template>
  <div class="grid gap-8">
    <div
      class="rounded-2xl card soft-shadow-lg overflow-hidden"
      @click="showApplications"
    >
      <div class="p-6 sm:p-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex-grow">
            <h3 class="text-2xl font-bold text-text-primary">{{ title }}</h3>
            <p class="mt-1 text-base text-text-secondary">{{ description }}</p>

            <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary">
              <span class="flex items-center gap-1.5">
                <FontAwesomeIcon icon="location-dot" class="text-xl" />
                {{ location }}
              </span>

              <span class="flex items-center gap-1.5">
                <FontAwesomeIcon icon="briefcase" class="text-xl" />
                {{ jobType.time }}
              </span>

              <span class="flex items-center gap-1.5">
                <FontAwesomeIcon icon="building" class="text-xl" />
                {{ jobType.workplace }}
              </span>
            </div>
          </div>

          <div class="flex flex-shrink-0 gap-3 sm:flex-col sm:items-end">
            <button
              @click.stop="onEdit"
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200 sm:w-auto cursor-pointer"
            >
              <FontAwesomeIcon icon="pen" class="text-xl" />
              <span>Edit</span>
            </button>

            <button
              @click.stop="onRemove"
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200 sm:w-auto cursor-pointer"
            >
              <FontAwesomeIcon icon="trash" class="text-xl" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
    background-color: #fff;
    cursor: pointer;
    transition: background-color 0.3s ease-in-out;
}

.card:hover {
    background-color: #f4f4f4;
}

.soft-shadow-lg {
  box-shadow: 0 6px 18px rgba(16,24,40,0.06);
}
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
