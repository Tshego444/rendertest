<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import axios from 'axios'
import { useUserStore } from '@/store/user'
import { useRouter } from 'vue-router'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'

// stores / composables
const userStore = useUserStore()
const { showError } = useError()
const { showSuccess } = useSuccess()
const router = useRouter()

// UI state
const currentJob = ref(null)
const allJobs = ref([])
const loading = ref(true)
const readMore = ref(false)
const transformStyle = ref('')
const applying = ref(false) // prevents double apply clicks
const cardAnimating = ref(false) // added: prevents multiple animations/actions while animating

// computed: viewed IDs pulled from user object
const viewedIds = computed(() => {
  const u = userStore?.user || {}
  return Array.isArray(u.applicationsViewed) ? u.applicationsViewed.map(String) : []
})

// fetch all jobs from server
async function fetchAllJobsFromServer() {
  loading.value = true
  try {
    const url = `/jobs`
    const token = userStore.token || localStorage.getItem('token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const resp = await axios.get(url, { headers })
    allJobs.value = Array.isArray(resp?.data) ? resp.data : []
    pickNextUnviewed()
  } catch (err) {
    console.error('Failed to fetch jobs:', err)
    const msg = err?.response?.data || err?.message || 'Failed to fetch jobs'
    showError(typeof msg === 'string' ? msg : 'Failed to fetch jobs')
  } finally {
    loading.value = false
  }
}

// pick next job whose jobID is NOT in viewedIds
function pickNextUnviewed() {
  const seen = new Set(viewedIds.value.map(String))
  const next = allJobs.value.find(j => !seen.has(String(j.jobID)))
  currentJob.value = next || null
  readMore.value = false
}

// mark current job as viewed (persist to server) and go to next
async function markViewedAndNext() {
  if (!currentJob.value) return

  // build new applicationsViewed array (string ids)
  const existing = Array.isArray(userStore.user?.applicationsViewed)
    ? [...userStore.user.applicationsViewed.map(String)]
    : []

  if (!existing.includes(String(currentJob.value.jobID))) {
    existing.push(String(currentJob.value.jobID))
  }

  // call backend to update user record
  try {
    const token = userStore.token || localStorage.getItem('token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    // choose identifier for user update: prefer Mongo id then legacy userID
    const userIdForUrl = userStore.user?.id || userStore.user?._id || userStore.user?.userID
    if (!userIdForUrl) {
      showError('Cannot determine user id to update viewed applications.')
      return
    }

    const url = `/users/${encodeURIComponent(userIdForUrl)}`

    // Save the response — your server returns { message: "...", user: <updatedUser> }
    const resp = await axios.put(url, { applicationsViewed: existing }, { headers })

    // Prefer server-returned updated user if present
    const updatedUser = resp?.data?.user || resp?.data || null

    if (updatedUser) {
      // update the reactive store
      try {
        userStore.user = { ...userStore.user, ...updatedUser }
      } catch (e) {
        // if Pinia store defines a setter, call it; otherwise fallback below
        console.warn('Could not set userStore.user directly:', e)
      }

      // persist to localStorage so page reload sees it
      try {
        // keep token in localStorage separately if you store it there
        localStorage.setItem('user', JSON.stringify(updatedUser))
      } catch (e) {
        console.warn('Could not persist updated user to localStorage:', e)
      }
    } else {
      // No user in response — fallback: update local store + localStorage with applicationsViewed
      try {
        const newLocalUser = { ...(userStore.user || {}), applicationsViewed: existing }
        try { userStore.user = newLocalUser } catch (_) {}
        localStorage.setItem('user', JSON.stringify(newLocalUser))
      } catch (e) {
        console.warn('Fallback persist failed:', e)
      }
    }
  } catch (err) {
    console.error('Failed to persist viewed application:', err)
    const msg = err?.response?.data || err?.message || 'Failed to mark viewed'
    showError(typeof msg === 'string' ? msg : 'Failed to mark viewed')
  } finally {
    // advance to next unviewed, regardless of server result — user won't be stuck
    pickNextUnviewed()
  }
}


// convenience helpers for UI actions
// modified: animate then call markViewedAndNext
function skipJob() {
  if (cardAnimating.value) return
  cardAnimating.value = true
  transformStyle.value = 'transform: translateX(-40px) rotate(-2deg); opacity: 0.85; transition: all 0.25s ease;'
    try {
      await markViewedAndNext()
    } finally {
      transformStyle.value = ''
      cardAnimating.value = false
    }
}

// NEW: acceptJob -> create application on backend then mark viewed + next
// modified: animate on press (but preserve applying guard and backend logic)
async function acceptJob() {
  if (!currentJob.value) return
  if (applying.value || cardAnimating.value) return

  // start animation immediately
  cardAnimating.value = true
  transformStyle.value = 'transform: translateX(40px) rotate(2deg); opacity: 0.85; transition: all 0.25s ease;'

  // delay actual apply logic slightly to allow tap animation to show (250ms)
    applying.value = true
    try {
      const jobId = currentJob.value.jobID
      const token = userStore.token || localStorage.getItem('token') || ''
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const url = `/jobs/${encodeURIComponent(jobId)}/apply`
      try {
        const resp = await axios.post(url, {}, { headers })
        console.log('Apply response:', resp?.data)
      } catch (applyErr) {
        // If already applied, backend returns 400 "Already applied" — treat as success and continue
        const status = applyErr?.response?.status
        const data = applyErr?.response?.data
        if (status === 400 && typeof data === 'string' && data.toLowerCase().includes('already applied')) {
          showSuccess('You have already applied to this job')
        } else {
          // unexpected error — show and stop advancing
          console.error('Apply failed:', applyErr)
          const msg = applyErr?.response?.data || applyErr?.message || 'Failed to apply'
          showError(typeof msg === 'string' ? msg : 'Failed to apply')
          // stop here so user can retry; reset flags and animation
          return
        }
      }

      // after successful apply (or already applied), mark viewed and advance
      await markViewedAndNext()
    } finally {
      applying.value = false
      transformStyle.value = ''
      cardAnimating.value = false
    }
}

// keyboard shortcuts
function onKey(e) {
  if (e.key === 'ArrowLeft') skipJob()
  if (e.key === 'ArrowRight') acceptJob()
}

// lifecycle
onMounted(() => {
  fetchAllJobsFromServer()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})
</script>



<template>
  <!-- Layout switches from column on small screens to row on md+ -->
  <div class="flex flex-col md:flex-row items-center justify-center p-4 md:p-6 min-h-[60vh]">

    <!-- Side action buttons for md+ screens -->
    <button
      class="hidden md:flex items-center m-5"
      @click="skipJob"
      title="Skip"
      aria-label="Skip job"
    > 
      <FontAwesomeIcon class="cursor-pointer bg-white text-3xl rounded-full p-4 shadow" icon="x" style="color: red" /> 
    </button>

    <div class="w-full max-w-4xl px-3 md:px-0">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg sm:text-2xl font-extrabold tracking-tight text-gray-900">Discover roles</h2>
          <p class="text-xs sm:text-sm text-gray-500">Swipe through curated job listings</p>
        </div>
      </div>

      <transition name="card-fade" mode="out-in">
        <!-- SKELETON - responsive min/max heights -->
        <div
          v-if="loading"
          key="skeleton"
          class="bg-white rounded-3xl shadow-2xl p-4 sm:p-6 animate-pulse min-h-[380px] md:h-[450px] max-h-[70vh] overflow-hidden flex flex-col justify-between"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gray-200"></div>
            <div class="flex-1">
              <div class="h-3 bg-gray-200 rounded w-3/5 mb-2"></div>
              <div class="h-2.5 bg-gray-200 rounded w-2/5"></div>
            </div>
            <div class="w-16 h-7 bg-gray-200 rounded"></div>
          </div>

          <div class="mt-4 space-y-2">
            <div class="h-3 bg-gray-200 rounded w-full"></div>
            <div class="h-3 bg-gray-200 rounded w-5/6"></div>
            <div class="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>

          <!-- bottom area to mirror footer space -->
          <div class="flex items-center justify-between mt-4">
            <div class="h-6 w-1/3 bg-gray-200 rounded"></div>
            <div class="h-6 w-1/6 bg-gray-200 rounded"></div>
          </div>
        </div>

        <!-- JOB CARD - responsive heights and scroll behaviour -->
        <div
          v-else-if="currentJob"
          key="job-card"
          class="relative z-10"
        >
          <div
            class="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transition-transform duration-300 flex flex-col min-h-[380px] md:h-[450px] max-h-[70vh]"
            :style="transformStyle"
          >
            <!-- Hero / header -->
            <div class="p-4 sm:p-6 flex items-start gap-4 sm:gap-6 flex-none">
              <div class="w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-50 text-2xl font-bold text-indigo-700 shadow-inner">
                <img v-if="currentJob.logo" :src="currentJob.logo" alt="company logo" class="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                <span v-else>{{ (currentJob.company || 'C').charAt(0) }}</span>
              </div>

              <div class="flex-1">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="text-base sm:text-xl font-bold text-gray-900">{{ currentJob.title }}</h3>
                    <p class="text-xs sm:text-sm text-gray-500 mt-1">{{ currentJob.company }} • <span class="text-gray-400">{{ currentJob.location || 'Remote' }}</span></p>
                  </div>
                </div>

                <p class="mt-3 text-gray-700 text-sm leading-relaxed">
                  <span v-if="!readMore">{{ currentJob.description?.slice(0, 200) }}<span v-if="currentJob.description && currentJob.description.length &gt; 200">... </span></span>
                  <span v-else>{{ currentJob.description }}</span>

                  <button v-if="currentJob.description && currentJob.description.length &gt; 200" @click="readMore = !readMore" class="ml-2 text-indigo-600 text-sm hover:underline">{{ readMore ? 'Show less' : 'Read more' }}</button>
                </p>

                <div class="mt-3 sm:mt-4 flex flex-wrap gap-2">
                  <template v-for="(skill, i) in (currentJob.skills || []).slice(0,6)" :key="i">
                    <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50/60 border border-indigo-100 text-indigo-700 text-sm">{{ skill }}</span>
                  </template>

                  <span v-if="(currentJob.skills || []).length > 6" class="inline-flex items-center px-3 py-1 rounded-full bg-gray-50 text-gray-600 text-sm">+{{ (currentJob.skills || []).length - 6 }} more</span>
                </div>
              </div>
            </div>

            <!-- responsibilities & body: scrollable area - limits on mobile to avoid huge cards -->
            <div class="px-4 sm:px-6 pb-4 overflow-auto flex-1" :class="{'max-h-[28vh] sm:max-h-none': true}">
              <h4 class="text-sm font-semibold text-gray-700 mb-2">Responsibilities</h4>
              <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-2">
                <li v-for="(task, idx) in currentJob.tasks" :key="idx" class="flex items-start gap-3 text-sm text-gray-600">
                  <span class="mt-1 inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  <span>{{ task }}</span>
                </li>
              </ul>
            </div>

            <!-- footer actions (pinned) -->
            <div class="px-4 sm:px-6 py-3 bg-gradient-to-t from-white/60 via-white/40 to-transparent border-t border-gray-100 flex items-center justify-between gap-4 flex-none">
              <div class="flex items-center gap-3">
                <!-- optional left area -->
              </div>

              <div class="flex items-center gap-4 text-sm">
                <div class="text-gray-500 text-xs sm:text-sm">Location: <span class="font-medium text-gray-700">{{ currentJob.location || 'Remote' }}</span></div>
                <div class="text-green-700 font-semibold text-sm">
                  <span v-if="Array.isArray(currentJob.salary)">R{{ currentJob.salary[0] }} - R{{ currentJob.salary[1] }}</span>
                  <span v-else>Salary not specified</span>
                </div>
              </div>
            </div>
          </div>

          <!-- little glow / accent (keeps same positioning) -->
          <div class="absolute -bottom-4 left-6 right-6 pointer-events-none flex justify-between opacity-40 hidden sm:flex">
            <div class="w-28 h-2 rounded-full bg-gradient-to-r from-indigo-300 to-cyan-200 blur-sm"></div>
            <div class="w-20 h-2 rounded-full bg-gradient-to-r from-rose-200 to-orange-200 blur-sm"></div>
          </div>
        </div>

        <!-- EMPTY -->
        <div v-else key="empty" class="bg-white rounded-3xl shadow-2xl p-6 text-center border border-gray-100 min-h-[380px] md:h-[450px] flex items-center justify-center">
          <div>
            <h3 class="text-base sm:text-lg font-semibold text-gray-800">You're all caught up</h3>
            <p class="text-sm text-gray-500 mt-2">No more new roles for now - Check back later or refresh the feed</p>
          </div>
        </div>
      </transition>

    </div>

    <!-- Side action buttons for md+ screens -->
    <button
      class="hidden md:flex items-center m-5"
      @click="acceptJob"
      title="Apply / Accept"
      aria-label="Accept job"
    > 
      <FontAwesomeIcon class="cursor-pointer bg-white text-3xl rounded-full p-4 shadow" icon="check" style="color: green" /> 
    </button>

    <!-- Mobile floating action bar -->
    <div
      class="fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-md sm:hidden flex justify-around items-center gap-6 
             bg-white/95 backdrop-blur-md border border-gray-200 rounded-full px-6 py-3 shadow-xl z-50">
      <button
        @click="skipJob"
        aria-label="Skip"
        class="flex flex-col items-center justify-center gap-1 text-gray-700 hover:text-red-600 active:scale-95 transition-all duration-150">
        <FontAwesomeIcon :icon="['fas','xmark']" class="text-2xl" />
        <span class="text-xs font-medium">Skip</span>
      </button>

      <button
        @click="acceptJob"
        aria-label="Apply"
        class="flex flex-col items-center justify-center gap-1 text-gray-700 hover:text-green-600 active:scale-95 transition-all duration-150">
        <FontAwesomeIcon :icon="['fas','check']" class="text-2xl" />
        <span class="text-xs font-medium">Apply</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-fade-enter-active, .card-fade-leave-active{ transition: all 260ms cubic-bezier(.2,.9,.2,1); }
.card-fade-enter-from { opacity: 0; transform: translateY(8px) scale(.995); }
.card-fade-enter-to { opacity: 1; transform: translateY(0) scale(1); }
.card-fade-leave-from { opacity: 1; transform: translateY(0) scale(1); }
.card-fade-leave-to { opacity: 0; transform: translateY(-8px) scale(.995); }

/* subtle pulse on apply (for show, not automatic) */
@keyframes apply-pulse { 0%{ transform: scale(1) } 50%{ transform: scale(1.03) } 100%{ transform: scale(1) } }

/* small tap feedback for buttons */
button:active {
  transform: scale(0.96);
  transition: transform 0.1s ease;
}

/* Slight "pop" for action feedback */
@keyframes press-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>
