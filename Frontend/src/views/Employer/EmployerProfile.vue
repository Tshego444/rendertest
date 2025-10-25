<script setup>
import Navbar from '@/components/Navbar.vue'
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'
import { isRequired, minLength, isEmail } from '@/Utils/Validation'
import axios from 'axios'

const userStore = useUserStore()
const { showError } = useError()
const { showSuccess } = useSuccess()

// defensive initial values (in case userStore.user or company is undefined)
const currentUser = userStore.user || {}
const name = ref(currentUser?.company?.name ?? '')
const email = ref(currentUser?.email ?? '')
const password = ref('')
const cpassword = ref('')
const location = ref(currentUser?.company?.location ?? '')
const industry = ref(currentUser?.company?.industry ?? '')

const loading = ref(false)

// Check if value has changed otherwise no need to process and validate
const hasChanged = (initialVal, newVal) => {
  return initialVal === newVal ? false : true
}

// Password Validation
const checkPassword = (passwordVal, cpasswordVal) => {
  // if user didn't enter a new password, it's okay (no change)
  if (passwordVal === '') return true

  if (!minLength(passwordVal, 6)) {
    showError('Password must be at least 6 characters long')
    return false
  }

  if (passwordVal !== cpasswordVal) {
    showError('Passwords must match')
    return false
  }

  return true
}

const submit = async () => {
  // originals
  const origName = currentUser?.company?.name ?? ''
  const origEmail = currentUser?.email ?? ''
  const origLocation = currentUser?.company?.location ?? ''
  const origIndustry = currentUser?.company?.industry ?? ''

  // Company name check (only if changed)
  if (
    hasChanged(origName, name.value) &&
    (!isRequired(name.value) || !minLength(name.value, 3))
  ) {
    showError('Please enter a valid company name (min 3 characters)')
    return
  }

  // Email check (only if changed)
  if (hasChanged(origEmail, email.value) && !isEmail(email.value)) {
    showError('Please enter a valid email')
    return
  }

  // Password checks
  if (!checkPassword(password.value, cpassword.value)) {
    return
  }

  // Location check (only if changed)
  if (
    hasChanged(origLocation, location.value) &&
    (!isRequired(location.value) || !minLength(location.value, 6))
  ) {
    showError('Please enter a valid location (min 6 characters)')
    return
  }

  // Industry check (only if changed)
  if (
    hasChanged(origIndustry, industry.value) &&
    (!isRequired(industry.value) || !minLength(industry.value, 3))
  ) {
    showError('Please enter a valid industry (min 3 characters)')
    return
  }

  // Build payload only with changed fields
  const payload = {}
  if (hasChanged(origName, name.value)) payload.companyName = name.value
  if (hasChanged(origLocation, location.value)) payload.companyLocation = location.value
  if (hasChanged(origIndustry, industry.value)) payload.industry = industry.value
  if (hasChanged(origEmail, email.value)) payload.email = email.value
  if (password.value) payload.password = password.value

  // nothing changed?
  if (Object.keys(payload).length === 0) {
    showSuccess('No changes to save')
    return
  }

  loading.value = true
  try {
    // determine user id - try id, _id, userID
    const userId = currentUser.id || currentUser._id || currentUser.userID
    if (!userId) {
      showError('Could not identify user ID for update')
      loading.value = false
      return
    }

    // build URL explicitly to avoid Vite front-end server (5173) intercepting requests
    const url = `/users/${userId}`

    // token from store or fallback to localStorage
    const token = userStore.token || localStorage.getItem('token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    // send JSON body
    const resp = await axios.put(url, payload, { headers })

    const updatedUser = resp?.data?.user || resp?.data
    if (!updatedUser) {
      showError('Profile updated but server response was unexpected')
    } else {
      updatedUser.userType = 'employer'
      userStore.login(updatedUser)
      showSuccess('Profile Updated Successfully')
      // clear password fields for UX
      password.value = ''
      cpassword.value = ''
    }
  } catch (err) {
    console.error('Employer profile update error:', err)
    // prefer server message if available
    const serverMsg = err?.response?.data || err?.response?.statusText
    showError(typeof serverMsg === 'string' ? serverMsg : 'Failed to update profile')
  } finally {
    loading.value = false
  }
}
</script>


<template>
  <Navbar />
  <div class="w-full max-w-4xl mx-auto p-6 mainview">
    <div class="card">
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">Profile</h1>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div>
          <label class="field-label" for="name">Company Name</label>
          <input
            id="name"
            v-model="name"
            class="form-input"
            placeholder="Company Name"
            type="text"
          />
        </div>

        <div>
          <label class="field-label" for="email">Email</label>
          <input id="email" v-model="email" class="form-input" placeholder="Email" type="email" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="field-label" for="password">Password</label>
            <input
              id="password"
              v-model="password"
              class="form-input"
              placeholder="Password"
              type="password"
            />
          </div>

          <div>
            <label class="field-label" for="cpassword">Confirm Password</label>
            <input
              id="cpassword"
              v-model="cpassword"
              class="form-input"
              placeholder="Confirm Password"
              type="password"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="field-label" for="location">Location</label>
            <input
              id="location"
              v-model="location"
              class="form-input"
              placeholder="Location"
              type="text"
            />
          </div>

          <div>
            <label class="field-label" for="industry">Industry</label>
            <input
              id="industry"
              v-model="industry"
              class="form-input"
              placeholder="Industry"
              type="text"
            />
          </div>
        </div>

        <div>
          <button type="button" class="btn w-full mt-2" @click="submit" :disabled="loading">Save Changes</button>
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

/* rest of your styles unchanged... */
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
}

.form-input:focus {
  outline: none;
  border-color: var(--mediumBlue);
}

.form-input.plain { 
  padding-right: 4.5rem;
} 

.btn { 
  border-radius: 0.9rem; 
  cursor: pointer; 
  background-color: var(--darkBlue); 
  color: white; padding: 0.9rem; 
  font-weight: 700; 
  transition: transform 120ms ease, 
  background-color 0.3s ease-in-out; 
  box-shadow: 0 8px 18px rgba(11, 22, 60, 0.08); 
} 

.btn:hover { 
  box-shadow: 0 18px 40px rgba(11, 22, 60, 0.12); 
}
</style>
