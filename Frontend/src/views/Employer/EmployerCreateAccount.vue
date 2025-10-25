<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { isRequired, minLength, isEmail } from '@/Utils/Validation'
import { useError } from '@/components/useError'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import axios from 'axios'
import { useUserStore } from '@/store/user' // adjust path if needed

import Spinner from '@/components/Spinner.vue'

const { showError } = useError()
const router = useRouter()
const userStore = useUserStore()

const name = ref('')
const email = ref(router.options.history.state?.email || '')
const password = ref(router.options.history.state?.password || '')

const companyLocation = ref('')
const companyIndustry = ref('')

const loading = ref(false)

// Save and validate
const submit = async () => {
  // simple front-end validation
  if (!isRequired(name.value) || !minLength(name.value, 3)) {
    showError('Please enter a company name (at least 3 characters)')
    return
  }

  if (!isRequired(email.value) || !isEmail(email.value)) {
    showError('Please enter a valid email')
    return
  }

  if (!isRequired(password.value) || !minLength(password.value, 6)) {
    showError('Password must be at least 6 characters')
    return
  }

  if (!isRequired(companyLocation.value) || !minLength(companyLocation.value, 3)) {
    showError('Please enter the company location')
    return
  }

  if (!isRequired(companyIndustry.value) || !minLength(companyIndustry.value, 2)) {
    showError('Please enter the company industry')
    return
  }

  loading.value = true

  try {
    // Build register payload - matches backend register route expectations
    const payload = {
      email: email.value,
      password: password.value,
      role: 'employer',
      firstName: '', // backend may use name, but keep fields safe
      lastName: '',
      // company related fields the backend expects
      companyName: name.value,
      companyLocation: companyLocation.value,
      industry: companyIndustry.value
    }

    // Register user
    await axios.post('/auth/register', payload) // expect 201
    // Immediately log them in to receive a token & user
    const loginResp = await axios.post('/auth/login', {
      email: email.value,
      password: password.value
    })

    // loginResp.data should contain token and user (per the login route)
    const { token, user } = loginResp.data

    // Save to Pinia store (use methods if available; fallback to direct assignment)
    if (typeof userStore.setToken === 'function') {
      userStore.setToken(token)
    } else {
      // fallback: set token state directly
      userStore.token = token
    }

    if (typeof userStore.setUser === 'function') {
      userStore.setUser(user)
    } else {
      // fallback: set user state directly
      userStore.user = user
    }

    // Optionally persist token in localStorage (so user remains logged in after refresh)
    try { localStorage.setItem('token', token) } catch (e) { /* ignore */ }

    // Redirect to feed
    router.push('/feed')

  } catch (err) {
    console.error('Registration/Login error:', err)
    // Show backend error messages if available
    const msg = err?.response?.data || err?.response?.statusText || 'Registration failed'
    showError(typeof msg === 'string' ? msg : 'Registration failed')
  } finally {
    loading.value = false
  }
}
</script>


<template>
  <div class="w-full max-w-4xl mx-auto p-6 mainview">
    <div class="card">
      <div v-if="loading" class="absolute top-5 right-5 z-20">
        <Spinner size="26" color="#3b82f6" />
      </div>

      <RouterLink to="/signup" class="back-arrow m-0.5">
        <FontAwesomeIcon icon="arrow-left" class="text-lg mb-2 text-black" />
      </RouterLink>

      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
              Continue Creating an Account
            </h1>
            <p class="text-sm text-gray-500 mt-1">A few details to finish your profile.</p>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <!-- id + name grid -->
        <div>
          <div>
            <label class="field-label" for="name">Company Name</label>
            <input
              id="name"
              v-model="name"
              class="form-input"
              placeholder="Employer"
              type="text"
              autocomplete="name"
            />
          </div>
        </div>

        <!-- email + password -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="field-label" for="email">Email</label>
            <input
              id="email"
              v-model="email"
              class="form-input"
              placeholder="e@gmail.com"
              type="email"
              autocomplete="email"
            />
          </div>

          <div>
            <label class="field-label" for="password">Password</label>
            <input
              id="password"
              v-model="password"
              class="form-input"
              placeholder="Enter a password"
              type="password"
              autocomplete="new-password"
            />
          </div>
        </div>

        <!-- company details -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="field-label" for="companyLocation">Company Location</label>
            <input
              id="companyLocation"
              v-model="companyLocation"
              class="form-input"
              placeholder="Sandton, Gauteng"
              type="text"
            />
          </div>

          <div>
            <label class="field-label" for="companyIndustry">Industry</label>
            <input
              id="companyIndustry"
              v-model="companyIndustry"
              class="form-input"
              placeholder="Technology"
              type="text"
            />
          </div>
        </div>

        <div>
          <button class="btn w-full mt-2" @click.prevent="submit" :disabled="loading">Create account</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
body {
  background-color: var(--lightBlue);
}

.card {
  position: relative;
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
}

.form-input:focus {
  outline: none;
  border-color: var(--mediumBlue);
}

.upload-zone {
  border-radius: 0.9rem;
  border: 1px solid rgba(14, 20, 30, 0.08);
  padding: 0.6rem;
  background: #fff;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
}
.upload-zone:focus,
.upload-zone:hover {
  background-color: #f0efef;
}

.upload-inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem;
}

.upload-text {
  flex: 1;
}

.upload-sub {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-name {
  font-size: 0.95rem;
  color: #374151;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-cv {
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-weight: 700;
}

.choose-btn {
  background: var(--mediumBlue);
  color: #fff;
  padding: 0.45rem 0.7rem;
  border-radius: 0.6rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.skills-container {
  margin-top: 0.5rem;
}

.skills-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0 0 0.5rem 0;
  padding: 0;
  list-style: none;
}

.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.35));
  border: 1px solid rgba(16, 24, 40, 0.06);
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.85rem;
  color: #0f172a; 
  box-shadow: 0 2px 6px rgba(12, 20, 30, 0.03);
}

.skill-text {
  padding-left: 2px;
}

.skill-remove {
  background: transparent;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
}

.skill-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.add-skill-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--mediumBlue);
  color: #fff;
  border: none;
  padding: 0.45rem 0.75rem;
  border-radius: 0.6rem;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.85rem;
  box-shadow: 0 6px 18px rgba(8, 18, 50, 0.08);
}

.add-skill-btn:active {
  transform: translateY(-50%) scale(0.99);
}

.btn {
  border-radius: 0.9rem;
  cursor: pointer;
  background-color: var(--darkBlue);
  color: white;
  padding: 0.9rem;
  font-weight: 700;
  transition:
    transform 120ms ease,
    background-color 0.3s ease-in-out;
  box-shadow: 0 8px 18px rgba(11, 22, 60, 0.08);
}
.btn:hover {
  box-shadow: 0 18px 40px rgba(11, 22, 60, 0.12);
}
</style>