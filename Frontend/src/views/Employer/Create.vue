<script setup>
import Navbar from '@/components/Navbar.vue'
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'
import { isRequired, minLength } from '@/Utils/Validation'
import { useUserStore } from '@/store/user'
import axios from 'axios'

// Notifications
const { showError } = useError()
const { showSuccess } = useSuccess()

// Router + stores
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// Form fields
const name = ref('')
const description = ref('')
const tasks = ref([])
const newTask = ref('')
const location = ref('')
const salary = ref([0, 0])
const jobType = ref({
  workplace: "Remote",
  time: "Full-time",
  role: "Senior"
})

const loading = ref(false)
const isEdit = !!route.params?.id
const editingJobID = route.params?.id || null

// Helper: get auth headers
function authHeaders() {
  const token = userStore.token || localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Pre-fill when editing: fetch job from server (fallback to jobStore if available)
onMounted(async () => {
  if (!isEdit) {
    // new listing: fill company defaults if desired
    return
  }

  loading.value = true
  try {
    // Prefer server source of truth
    const url = `/jobs/${editingJobID}`
    const resp = await axios.get(url, { headers: authHeaders() })
    const job = resp?.data

    console.log(job)

    if (!job) {
        showError('Job not found')
        router.push('/dashboard')
    }

    // Ownership check: ensure logged-in employer owns the job (or is admin)
    const currentUserID = userStore.user.id
    const isOwner = String(job.employerID) === String(currentUserID) || userStore.user?.userType === 'admin' || userStore.user?.role === 'admin'
    if (!isOwner) {
      showError('Unauthorized Access')
      router.push('/dashboard')
      return
    }

    fillFormFromJob(job)
  } catch (err) {
    // if server returns 404, fallback to jobStore
    if (err?.response?.status === 404) {
        showError('Job not found')
        router.push('/dashboard')
    } else {
      console.error('Error fetching job for edit:', err)
      showError('Failed to load job for editing')
      router.push('/dashboard')
    }
  } finally {
    loading.value = false
  }
})

function fillFormFromJob(job) {
  name.value = job.title || ''
  description.value = job.description || ''
  location.value = job.location || ''
  salary.value = Array.isArray(job.salary) && job.salary.length === 2 ? [Number(job.salary[0]||0), Number(job.salary[1]||0)] : [0,0]
  jobType.value = job.jobType || { workplace: 'Remote', time: 'Full-time', role: 'Senior' }
  tasks.value = Array.isArray(job.tasks) ? [...job.tasks] : []
}

// Validate and save job
const submit = async () => {
  // Validate role name
  if (!isRequired(name.value) || !minLength(name.value, 3)) {
    showError('Please enter a valid role name (min 3 characters)')
    return
  }

  // Validate description
  if (!isRequired(description.value) || !minLength(description.value, 10)) {
    showError('Please enter a description of at least 10 characters')
    return
  }

  // Validate location
  if (!isRequired(location.value) || !minLength(location.value, 3)) {
    showError('Please enter a valid location')
    return
  }

  // Validate salary
  if (!Number.isFinite(salary.value[0]) || !Number.isFinite(salary.value[1])) {
    showError('Please enter both minimum and maximum salary')
    return
  }
  if (salary.value[0] < 0 || salary.value[1] < 0) {
    showError('Salary values cannot be negative')
    return
  }
  if (salary.value[0] > salary.value[1]) {
    showError('Minimum salary cannot be greater than maximum salary')
    return
  }

  // Validate job type
  if (!isRequired(jobType.value.workplace)) {
    showError('Please select a workplace type')
    return
  }
  if (!isRequired(jobType.value.time)) {
    showError('Please select a time type')
    return
  }
  if (!isRequired(jobType.value.role)) {
    showError('Please select a role level')
    return
  }

  // Validate tasks
  if (!Array.isArray(tasks.value) || tasks.value.length < 3) {
    showError('Please add at least 3 tasks')
    return
  }

  loading.value = true
  try {
    const payload = {
      title: name.value,
      company: userStore.user?.company?.name || userStore.user?.company || '', // prefer company name string
      description: description.value,
      location: location.value,
      salary: [Number(salary.value[0]), Number(salary.value[1])],
      jobType: jobType.value,
      tasks: tasks.value,
      user: useUserStore.user
    }

    const headers = { ...authHeaders() }
    // Create new job
    if (!isEdit) {
      const url =  '/jobs'
      const resp = await axios.post(url, payload, { headers })
      
      showSuccess('Job listing created successfully')
    } else {
      // Update existing job by jobID
      const url = `/jobs/${editingJobID}`
      const resp = await axios.put(url, payload, { headers })

      showSuccess('Job listing updated successfully')
    }

    router.push('/dashboard')
  } catch (err) {
    console.error('Create/update job error:', err)
    const serverMsg = err?.response?.data || err?.response?.statusText || err?.message
    showError(typeof serverMsg === 'string' ? serverMsg : 'Failed to save job')
  } finally {
    loading.value = false
  }
}

// Add new task
const addTask = () => {
  const task = (newTask.value || '').trim()

  if (!isRequired(task) || !minLength(task, 3)) {
    showError('Task must be at least 3 characters long')
    return
  }

  if (tasks.value.includes(task)) {
    showError('This task has already been added')
    return
  }

  tasks.value.push(task)
  newTask.value = ''
}

// Remove task by index
const removeTask = (index) => {
  tasks.value.splice(index, 1)
}
</script>



<template>
  <Navbar />
  <div class="w-full max-w-4xl mx-auto p-6 mainview">
    <div class="card">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
            {{ route.path === '/employer/create' ? 'Create a job listing' : 'Edit job listing' }}
        </h1>
      </div>

      <div class="space-y-6">
        <!-- role -->
        <div>
          <label class="field-label" for="name">Role Name</label>
          <input
            id="name"
            v-model="name"
            class="form-input"
            placeholder="Role Name"
            type="text"
          />
        </div>

        <!-- description -->
        <div>
          <label class="field-label" for="description">Description</label>
          <textarea
            id="description"
            v-model="description"
            class="form-input"
            placeholder="Job description"
            rows="4"
          ></textarea>
        </div>

        <div>

        <label class="field-label" for="location">Location</label>
        <input
            id="location"
            v-model="location"
            class="form-input"
            placeholder="Enter location (e.g., Sandton, Gauteng)"
            type="text"
        />
        </div>

        <div class="grid grid-cols-2 gap-4">
        <div>
            <label class="field-label" for="salaryMin">Salary (Min)</label>
            <input
            id="salaryMin"
            v-model.number="salary[0]"
            class="form-input"
            placeholder="e.g., 18000"
            type="number"
            />
        </div>

        <div>
            <label class="field-label" for="salaryMax">Salary (Max)</label>
            <input
            id="salaryMax"
            v-model.number="salary[1]"
            class="form-input"
            placeholder="e.g., 22000"
            type="number"
            />
        </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
        <div>
            <label class="field-label" for="workplace">Workplace</label>
            <select id="workplace" v-model="jobType.workplace" class="form-input">
            <option value="Remote">Remote</option>
            <option value="On-site">On-site</option>
            <option value="Hybrid">Hybrid</option>
            </select>
        </div>

        <div>
            <label class="field-label" for="time">Time</label>
            <select id="time" v-model="jobType.time" class="form-input">
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
            </select>
        </div>

        <div>
            <label class="field-label" for="role">Role</label>
            <select id="role" v-model="jobType.role" class="form-input">
            <option value="Junior">Junior</option>
            <option value="Mid">Mid</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            </select>
        </div>
        </div>

        <!-- tasks -->
        <div>
          <label class="field-label">Tasks</label>
          <div class="flex gap-2 mb-3">
            <input
              v-model="newTask"
              class="form-input flex-1"
              placeholder="Add a task"
              type="text"
              @keyup.enter="addTask"
            />
            <button type="button" class="btn px-4" @click="addTask">Add</button>
          </div>

          <ul class="space-y-2">
            <li
              v-for="(task, index) in tasks"
              :key="index"
              class="flex items-center justify-between bg-gray-50 p-2 rounded-lg"
            >
              <span>{{ task }}</span>
              <button
                type="button"
                class="text-red-500 font-semibold hover:underline cursor-pointer"
                @click="removeTask(index)"
              >
                Remove
              </button>
            </li>
          </ul>
        </div>

        <!-- submit -->
        <div>
            <button type="button" class="btn w-full mt-2" @click="submit">
                {{ route.path === '/employer/create' ? 'Add' : 'Save Changes' }}
            </button>       
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mainview {
  background-color: var(--lightBlue);
}

.card {
  background-color: #fff;
  border-radius: 1.5rem;
  box-shadow:
    0 8px 20px -8px var(--shadow-color),
    0 6px 12px -8px rgba(0, 0, 0, 0.04);
  padding: 1.5rem;
}

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  letter-spacing: 0.2px;
}

.form-input {
  width: 100%;
  background-color: #fff;
  border: 2px solid #e6e9ef;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  transition: border-color 0.3s ease-in-out;
  color: var(--mediumBlue);
  font-size: 0.95rem;
  resize: none;
}

.form-input:focus {
  outline: none;
  border-color: var(--mediumBlue);
}

.btn {
  border-radius: 0.9rem;
  cursor: pointer;
  background-color: var(--darkBlue);
  color: white;
  padding: 0.9rem 1.2rem;
  font-weight: 700;
  transition: transform 120ms ease, background-color 0.3s ease-in-out;
  box-shadow: 0 8px 18px rgba(11, 22, 60, 0.08);
}
.btn:hover {
  box-shadow: 0 18px 40px rgba(11, 22, 60, 0.12);
}
</style>
