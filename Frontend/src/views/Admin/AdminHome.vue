<script setup>
import Navbar from '@/components/Navbar.vue'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'
import { useUserStore } from '@/store/user'
import axios from 'axios'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const router = useRouter()
const { showError } = useError()
const { showSuccess } = useSuccess()
const userStore = useUserStore()

const loading = ref(true)
const searchTerm = ref('')
const roleFilter = ref('All')
const roleTabs = ['All', 'seeker', 'employer', 'admin']

const users = ref([]) // fetched from backend

// Modal state + form
const editModalOpen = ref(false)
const editForm = reactive({
  id: '', // backend mongo _id if available
  userID: '',
  name: '',
  email: '',
  password: '',
  userType: '',
  makeAdmin: false,
  // seeker profile
  profile_skills_csv: '',
  profile_experience: '',
  profile_location: '',
  profile_cv: '',
  // employer company
  company_name: '',
  company_location: '',
  company_industry: ''
})

// Build auth headers for axios
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Load users from backend (admin-only)
// NOTE: backend may return either an array (legacy) or an object { users: [...], total, page, ... }
async function loadUsers() {
  loading.value = true
  try {
    const res = await axios.get('/users', { headers: authHeaders() })
    const d = res?.data

    // handle different shapes
    if (Array.isArray(d)) {
      users.value = d
    } else if (d && Array.isArray(d.users)) {
      users.value = d.users
    } else if (d && Array.isArray(d.data)) {
      users.value = d.data
    } else {
      // fallback: try to pull first array-like property
      let found = null
      if (d && typeof d === 'object') {
        for (const k of Object.keys(d)) {
          if (Array.isArray(d[k])) { found = d[k]; break }
        }
      }
      users.value = found || []
    }

    // Normalize each user so UI expects consistent fields
    users.value = users.value.map(u => ({
      id: u.id || u._id || null,
      userID: u.userID || null,
      name: u.name || null,
      email: u.email || null,
      userType: u.userType || u.role || null,
      company: u.company || null,
      profile: u.profile || null,
      // keep original to avoid accidentally losing backend fields used elsewhere
      __raw: u
    }))
  } catch (err) {
    console.error('Failed to load users from backend', err)
    const msg = err?.response?.data || err?.message || 'Failed to load users'
    showError(typeof msg === 'string' ? msg : 'Failed to load users')
    users.value = []
  } finally {
    loading.value = false
  }
}

// mount -> fetch from server
onMounted(() => {
  loadUsers()
})

// simple helpers
function displayName(u) {
  return u?.name || u?.company?.name || `User ${u?.userID || ''}`
}

const qLower = computed(() => String(searchTerm.value || '').trim().toLowerCase())

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    // Role filter
    if (roleFilter.value !== 'All' && String(u.userType || '') !== String(roleFilter.value)) {
      return false
    }

    if (!qLower.value) return true

    const term = qLower.value
    const name = String(u.name || '').toLowerCase()
    const email = String(u.email || '').toLowerCase()
    const id = String(u.userID || '').toLowerCase()
    const companyName = u.company && u.company.name ? String(u.company.name).toLowerCase() : ''

    // Match against name, email, id, or company name
    return (
      name.includes(term) ||
      email.includes(term) ||
      id.includes(term) ||
      companyName.includes(term)
    )
  })
})


function getRoleBadgeClasses(role) {
  switch (String(role || '').toLowerCase()) {
    case 'seeker':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    case 'employer':
      return 'bg-blue-50 text-blue-700 border-blue-100'
    case 'admin':
      return 'bg-red-50 text-red-700 border-red-100'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-100'
  }
}

// --- Modal helpers ---
function openEditModal(user) {
  // prefer backend id if available
  editForm.id = user.id || user._id || (user.__raw && (user.__raw._id || user.__raw.id)) || ''
  editForm.userID = user.userID || (user.__raw && user.__raw.userID) || ''
  editForm.name = user.name || ''
  editForm.email = user.email || ''
  editForm.password = ''
  editForm.userType = user.userType || user.role || ''
  editForm.makeAdmin = String(editForm.userType).toLowerCase() === 'admin'

  // reset role-specific fields
  editForm.profile_skills_csv = ''
  editForm.profile_experience = ''
  editForm.profile_location = ''
  editForm.profile_cv = ''
  editForm.company_name = ''
  editForm.company_location = ''
  editForm.company_industry = ''

  // pre-fill from returned profile/company shapes (safe)
  const profile = user.profile || (user.__raw && user.__raw.profile) || null
  const company = user.company || (user.__raw && user.__raw.company) || null

  if ((editForm.userType === 'seeker') && profile) {
    const skills = profile.skills && Array.isArray(profile.skills) ? profile.skills.join(', ') : (typeof profile.skills === 'string' ? profile.skills : '')
    editForm.profile_skills_csv = skills
    editForm.profile_experience = profile.experience ?? ''
    editForm.profile_location = profile.location ?? ''
    editForm.profile_cv = profile.cv ?? ''
  } else if ((editForm.userType === 'employer') && company) {
    editForm.company_name = company.name ?? ''
    editForm.company_location = company.location ?? ''
    editForm.company_industry = company.industry ?? ''
  }

  editModalOpen.value = true
}

watch(() => editForm.userType, (newType) => {
  if (!newType) return
  if (newType === 'seeker') {
    editForm.company_name = ''
    editForm.company_location = ''
    editForm.company_industry = ''
  } else if (newType === 'employer') {
    editForm.profile_skills_csv = ''
    editForm.profile_experience = ''
    editForm.profile_location = ''
    editForm.profile_cv = ''
  } else if (newType === 'admin') {
    editForm.profile_skills_csv = ''
    editForm.profile_experience = ''
    editForm.profile_location = ''
    editForm.profile_cv = ''
    editForm.company_name = ''
    editForm.company_location = ''
    editForm.company_industry = ''
  }
})

function closeEditModal() {
  editModalOpen.value = false
}

// Save changes to backend
let saving = ref(false)
async function saveEdit() {
  if (saving.value) return
  if (!editForm.userID && !editForm.id) {
    showError('Missing user identifier.')
    return
  }
  if (!editForm.name || !editForm.email) {
    showError('Name and email are required.')
    return
  }

  saving.value = true
  try {
    const payload = { name: editForm.name, email: editForm.email }
    if (editForm.password && editForm.password.trim()) payload.password = editForm.password.trim()

    // Only include userType change if promote to admin selected
    if (editForm.makeAdmin) payload.userType = 'admin'

    if (editForm.userType === 'seeker') {
      if (editForm.profile_skills_csv !== '') payload.skills = editForm.profile_skills_csv
      if (editForm.profile_experience !== '') payload.experience = editForm.profile_experience
      if (editForm.profile_location !== '') payload.location = editForm.profile_location
      if (editForm.profile_cv) payload.cv = editForm.profile_cv
    } else if (editForm.userType === 'employer') {
      if (editForm.company_name !== '') payload.companyName = editForm.company_name
      if (editForm.company_location !== '') payload.companyLocation = editForm.company_location
      if (editForm.company_industry !== '') payload.industry = editForm.company_industry
    }

    // Choose path param: prefer mongo id if we have it, else legacy userID
    const idParam = editForm.id && String(editForm.id).trim() ? String(editForm.id) : String(editForm.userID)

    const res = await axios.put(`/users/${encodeURIComponent(idParam)}`, payload, { headers: authHeaders() })
    const updated = res?.data?.user || res?.data || null

    if (!updated) {
      showSuccess('Saved (no detailed response). Refreshing list.')
      await loadUsers()
    } else {
      const normalized = {
        id: updated.id || updated._id || normalized?.id || '',
        userID: updated.userID || updated.userID || '',
        name: updated.name || editForm.name,
        email: updated.email || editForm.email,
        userType: updated.userType || updated.role || editForm.userType,
        company: updated.company || null,
        profile: updated.profile || null
      }

      const idx = users.value.findIndex(u => String(u.userID || '') === String(normalized.userID || '') || String(u.id || '') === String(normalized.id || ''))
      if (idx !== -1) {
        users.value[idx] = { ...users.value[idx], ...normalized }
      } else {
        users.value.unshift(normalized)
      }
    }

    showSuccess('User saved.')
    closeEditModal()

    // refresh authoritative list
    await loadUsers()
  } catch (err) {
    console.error('Failed to save user', err)
    const msg = err?.response?.data || err?.message || 'Failed to save user'
    showError(typeof msg === 'string' ? msg : 'Failed to save user')
  } finally {
    saving.value = false
  }
}

// Delete user via backend (admin-only)
let deleting = ref(false)
async function confirmRemove(user) {
  // guard: don't allow deleting currently logged-in admin
  const currentUser = userStore.user || {}
  if (currentUser.userID && user.userID && String(currentUser.userID) === String(user.userID)) {
    showError('You cannot remove the currently logged in admin.')
    return
  }
  if (currentUser.id && user.id && String(currentUser.id) === String(user.id)) {
    showError('You cannot remove the currently logged in admin.')
    return
  }

  const ok = window.confirm(`Remove user: ${user.name || user.email} - ID: ${user.userID || user.id || user._id}?`)
  if (!ok) return

  deleting.value = true
  try {
    const idParam = user.id || user._id || user.userID
    await axios.delete(`/users/${encodeURIComponent(String(idParam))}`, { headers: authHeaders() })

    // Re-fetch authoritative list from backend rather than only mutating locally
    await loadUsers()

    showSuccess('User deleted.')
  } catch (err) {
    console.error('Failed to delete user', err)
    const msg = err?.response?.data || err?.message || 'Failed to delete user'
    showError(typeof msg === 'string' ? msg : 'Failed to delete user')
  } finally {
    deleting.value = false
  }
}

</script>


<template>
  <div class="relative flex min-h-screen flex-col">
    <Navbar />

    <div class="px-10 py-5 lg:px-40">
      <div class="layout-content-container flex flex-col gap-8">
        <div class="flex flex-wrap justify-between items-center gap-4">
          <div class="flex flex-col gap-2">
            <p class="text-slate-800 tracking-light text-4xl font-bold leading-tight">Users</p>
            <p class="text-slate-500 text-base font-normal leading-normal">View and manage users</p>
          </div>
        </div>

        <!-- Search & Role filter -->
        <div class="flex flex-col gap-4">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="max-w-md w-full">
              <label class="relative block">
                <span class="sr-only">Search users</span>
                <span class="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FontAwesomeIcon :icon="['fas','search']" />
                </span>
                <input
                  v-model="searchTerm"
                  class="block w-full rounded-full py-3 pl-10 pr-4 border border-gray-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  placeholder="Search users by name, email or ID"
                />
              </label>
            </div>
          </div>

          <div class="flex gap-3 flex-wrap">
            <button
              v-for="tab in roleTabs"
              :key="tab"
              @click="roleFilter = tab"
              :class="['h-10 shrink-0 flex items-center justify-center gap-x-2 rounded-lg px-4 text-sm font-medium leading-normal cursor-pointer']"
              :style="roleFilter === tab ? 'background: var(--mediumBlue); color: white' : 'background: #fff'"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <!-- Users Table -->
        <div class="flex flex-col rounded-2xl bg-white overflow-hidden">
          <div class="overflow-x-auto">
            <div class="min-h-[45vh] max-h-[45vh] overflow-y-auto">
              <table class="w-full min-w-min">
                <thead class="border-b border-gray-200">
                  <tr class="bg-slate-50">
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-[320px] text-xs font-medium uppercase tracking-wider bg-slate-50">Name</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-[260px] text-xs font-medium uppercase tracking-wider bg-slate-50">Email</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-left text-slate-500 w-36 text-xs font-medium uppercase tracking-wider bg-slate-50">Role</th>
                    <th class="sticky top-0 z-10 px-6 py-4 text-right text-slate-500 w-auto text-xs font-medium uppercase tracking-wider bg-slate-50">Actions</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-gray-200">
                  <tr v-if="loading">
                    <td colspan="4" class="px-6 py-6 text-center text-slate-500">Loading users...</td>
                  </tr>

                  <tr v-else-if="!loading && filteredUsers.length === 0">
                    <td colspan="4" class="px-6 py-6 text-center text-slate-500">No users found.</td>
                  </tr>

                  <template v-else>
                    <tr v-for="u in filteredUsers" :key="u.userID || u.id || u._id">
                      <td class="px-6 py-4">
                        <div>
                          <div class="text-slate-800 font-semibold">{{ displayName(u) }}</div>
                          <div class="text-xs text-slate-400">ID: {{ u.userID || u.id || u._id }}</div>
                        </div>
                      </td>

                      <td class="px-6 py-4">
                        <div class="text-slate-700 font-medium">{{ u.email }}</div>
                      </td>

                      <td class="px-6 py-4">
                        <div :class="`${getRoleBadgeClasses(u.userType)} inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium border`">
                          {{ u.userType || '—' }}
                        </div>
                      </td>

                      <td class="px-6 py-4 text-right">
                        <div class="flex gap-2 justify-end inline-flex">
                          <button @click="openEditModal(u)" class="rounded-lg px-3 py-2 border border-gray-200 hover:shadow text-sm cursor-pointer inline-flex items-center gap-2">
                            <FontAwesomeIcon :icon="['fas','pen']" /> Edit
                          </button>
                          <button @click="confirmRemove(u)" class="rounded-lg px-3 py-2 border border-rose-200 hover:bg-rose-50 text-sm text-rose-600 cursor-pointer inline-flex items-center gap-2">
                            <FontAwesomeIcon :icon="['fas','trash']" /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/40" @click="closeEditModal"></div>

      <div class="relative bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl z-10">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-slate-800">Edit user</h3>
            <p class="text-sm text-slate-500">Modify user details and save.</p>
          </div>
          <button @click="closeEditModal" class="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
        </div>

        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-slate-500">Full name</label>
            <input v-model="editForm.name" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
          </div>

          <div>
            <label class="text-xs text-slate-500">Email</label>
            <input v-model="editForm.email" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
          </div>

          <!-- Role display + promote control -->
          <div>
            <label class="text-xs text-slate-500">Role</label>
            <div class="mt-1 flex items-center justify-between gap-3">
              <div class="text-sm text-slate-700">
                <div class="font-medium">{{ editForm.userType || '—' }}</div>
                <div class="text-xs text-slate-400">Current role</div>
              </div>

              <label class="inline-flex items-center gap-2">
                <input type="checkbox" v-model="editForm.makeAdmin" :disabled="String(editForm.userType).toLowerCase() === 'admin'" class="rounded border-gray-300" />
                <span class="text-sm text-slate-600">Promote to admin</span>
              </label>
            </div>
          </div>

          <div>
            <label class="text-xs text-slate-500">Password</label>
            <input type="password" v-model="editForm.password" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
          </div>

          <!-- seeker fields -->
          <template v-if="editForm.userType === 'seeker'">
            <div class="sm:col-span-2">
              <label class="text-xs text-slate-500">Skills (comma separated)</label>
              <input v-model="editForm.profile_skills_csv" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="JavaScript, Vue.js, Node.js" />
            </div>

            <div>
              <label class="text-xs text-slate-500">Experience (years)</label>
              <input v-model="editForm.profile_experience" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>

            <div>
              <label class="text-xs text-slate-500">Location</label>
              <input v-model="editForm.profile_location" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>

            <div class="sm:col-span-2">
              <label class="text-xs text-slate-500">CV filename / url</label>
              <input v-model="editForm.profile_cv" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>
          </template>

          <!-- employer fields -->
          <template v-if="editForm.userType === 'employer'">
            <div>
              <label class="text-xs text-slate-500">Company name</label>
              <input v-model="editForm.company_name" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>

            <div>
              <label class="text-xs text-slate-500">Company location</label>
              <input v-model="editForm.company_location" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>

            <div class="sm:col-span-2">
              <label class="text-xs text-slate-500">Industry</label>
              <input v-model="editForm.company_industry" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2" />
            </div>
          </template>

        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button @click="closeEditModal" class="rounded-lg px-4 py-2 border border-gray-200 cursor-pointer">Cancel</button>
          <button @click="saveEdit" class="rounded-lg px-4 py-2 btn_sc text-white cursor-pointer">Save changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn_sc{
  background-color: var(--darkBlue);
}
</style>
