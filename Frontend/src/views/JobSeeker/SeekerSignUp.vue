<script setup>
import { ref, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { isRequired, minLength, inRange } from '@/Utils/Validation'
import { useError } from '@/components/useError'
import axios from 'axios'
import { useUserStore } from '@/store/user'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import Spinner from '@/components/Spinner.vue'

const { showError } = useError()
const router = useRouter()
const userStore = useUserStore()

// form state
const firstName = ref('')
const surname = ref('')
const skills = ref([])
const newSkill = ref('')
const yearsExp = ref(1)
const location = ref('')
const email = ref(router.options.history.state?.email || '')
const password = ref(router.options.history.state?.password || '')
const cvFile = ref(null)
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const loading = ref(false)

// skills helpers
function addSkill() {
  const s = (newSkill.value || '').trim()
  if (!s) return
  if (!skills.value.includes(s)) skills.value.push(s)
  newSkill.value = ''
}
function onSkillKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addSkill()
  }
}
function removeSkill(index) {
  skills.value.splice(index, 1)
}

// file handling
const cvName = computed(() => (cvFile.value ? cvFile.value.name : ''))

function processFile(file) {
  if (!file) return
  if (file.type !== 'application/pdf') {
    showError('Unsupported file type. Please upload PDF only')
    return
  }
  if (file.size > MAX_SIZE) {
    showError('File is too large. Maximum allowed size is 5 MB.')
    return
  }
  cvFile.value = file
}

function handleFileChange(e) {
  const f = e.target.files?.[0]
  processFile(f)
  e.target.value = ''
}

function onDrop(e) {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  processFile(f)
}
function onDragOver(e) { e.preventDefault() }
function removeCv() { cvFile.value = null }

// build form validation
function validate() {
  if (!isRequired(firstName.value) || !minLength(firstName.value, 3)) {
    showError('Please enter a first name (at least 3 characters)')
    return false
  }
  if (!isRequired(surname.value) || !minLength(surname.value, 3)) {
    showError('Please enter a surname (at least 3 characters)')
    return false
  }
  if (!isRequired(location.value) || !minLength(location.value, 6)) {
    showError('Please enter a valid location')
    return false
  }
  if (!isRequired(yearsExp.value) || !inRange(yearsExp.value, 1, 60)) {
    showError('Please enter years of experience (1-60)')
    return false
  }
  if (skills.value.length < 3) {
    showError('Please enter at least 3 skills')
    return false
  }
  if (!isRequired(email.value) || !/\S+@\S+\.\S+/.test(email.value)) {
    showError('Please enter a valid email')
    return false
  }
  if (!isRequired(password.value) || !minLength(password.value, 6)) {
    showError('Password must be at least 6 characters')
    return false
  }
  if (!cvFile.value) {
    showError('Please upload your CV (PDF)')
    return false
  }
  return true
}

// submit: register -> login -> save state -> redirect
const submit = async () => {
  if (!validate()) return

  loading.value = true
  try {
    // Use FormData for file upload + other fields
    const fd = new FormData()
    fd.append('email', email.value)
    fd.append('password', password.value)
    fd.append('role', 'jobseeker') // backend expects jobseeker|employer|admin

    // seeker-specific fields expected by register route
    fd.append('firstName', firstName.value)
    fd.append('lastName', surname.value)
    fd.append('age', yearsExp.value) // optional mapping
    fd.append('location', location.value)
    fd.append('experience', String(yearsExp.value))
    // skills as JSON string (backend handler accepts JSON array or comma string)
    fd.append('skills', JSON.stringify(skills.value))

    // attach CV file under 'pdf' (multer single('pdf') on server)
    if (cvFile.value) fd.append('pdf', cvFile.value, cvFile.value.name)

    // register
    const regResp = await axios.post('/auth/register', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    // If your backend returns token/user on register, use that. Otherwise login.
    let token, user
    if (regResp?.data?.token && regResp?.data?.user) {
      token = regResp.data.token
      user = regResp.data.user
    } else {
      // perform login to receive token
      const loginResp = await axios.post('/auth/login', {
        email: email.value,
        password: password.value
      })
      token = loginResp?.data?.token
      user = loginResp?.data?.user
    }

    if (!token || !user) {
      throw new Error('Registration succeeded but failed to obtain auth token.')
    }

    // Save into user store (support methods or fallback)
    if (typeof userStore.setToken === 'function') {
      userStore.setToken(token)
    } else {
      userStore.token = token
    }

    if (typeof userStore.setUser === 'function') {
      userStore.setUser(user)
    } else {
      userStore.user = user
    }

    // persist token
    try { localStorage.setItem('token', token) } catch(e){}

    // redirect to feed
    router.push('/feed')

  } catch (err) {
    console.error('Registration error:', err)
    const msg = err?.response?.data || err?.response?.statusText || err?.message || 'Registration failed'
    showError(typeof msg === 'string' ? msg : 'Registration failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-4xl mx-auto p-6 mainview">
    <div class="card">

      <div v-if="loading" class="spinner-top-right" role="status" aria-busy="true" aria-label="Loading">
        <!-- bound props: :size and :color (adjust prop names if your Spinner component differs) -->
        <Spinner :size="26" :color="'#3b82f6'" />
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
        <!-- name grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="field-label" for="fname">First name</label>
            <input
              id="fname"
              v-model="firstName"
              class="form-input"
              placeholder="First name"
              type="text"
              autocomplete="given-name"
            />
          </div>

          
          <div>
            <label class="field-label" for="sname">Surname</label>
            <input
              id="sname"
              v-model="surname"
              class="form-input"
              placeholder="Surname"
              type="text"
              autocomplete="family-name"
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

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="md:col-span-3">
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
            <label class="field-label" for="yearsExp">Years Experience</label>
            <input
              id="experience"
              v-model="yearsExp"
              class="form-input"
              placeholder="Years Experience"
              type="number"
            />
          </div>
        </div>

        <div>
          <label class="field-label" for="skillInput">Skills</label>

          <div class="skills-container">
            <ul class="skills-list" aria-live="polite">
              <li v-for="(s, i) in skills" :key="s" class="skill-chip">
                <span class="skill-text">{{ s }}</span>
                <button
                  type="button"
                  class="skill-remove"
                  @click="removeSkill(i)"
                  aria-label="Remove skill"
                >
                  x
                </button>
              </li>
            </ul>

            <div class="skill-input-wrap">
              <input
                id="skillInput"
                v-model="newSkill"
                @keydown="onSkillKey"
                class="form-input plain"
                placeholder="Enter a skill and press Enter or Add"
                type="text"
                aria-describedby="skillHelp"
              />
              <button type="button" class="add-skill-btn" @click="addSkill">Add</button>
            </div>

            <p id="skillHelp" class="text-xs text-gray-400 mt-2">
              Press Enter to add, or click <em>Add</em>. Remove unwanted skills by clicking x.
            </p>
          </div>
        </div>

        <div>
          <label class="field-label">Upload CV</label>

          <div
            class="upload-zone"
            @drop="onDrop"
            @dragover="onDragOver"
            @keydown.enter.prevent=""
            tabindex="0"
            role="button"
            aria-describedby="cvHelp"
          >
            <input
              id="cvInput"
              type="file"
              accept=".pdf, application/pdf"
              class="sr-only"
              @change="handleFileChange"
            />

            <div class="upload-inner">
              <div class="upload-text">
                <div class="upload-title">
                  <strong v-if="cvName">Selected file:</strong>
                  <strong v-else>Drag & drop or click to upload</strong>
                </div>

                <div class="upload-sub">
                  <template v-if="cvName">
                    <span class="file-name">{{ cvName }}</span>
                    <button
                      type="button"
                      class="remove-cv"
                      @click="removeCv"
                      aria-label="Remove CV"
                    >
                      Remove
                    </button>
                  </template>
                  <template v-else>
                    <span class="text-xs text-gray-400">PDF Only — max 5 MB</span>
                  </template>
                </div>
              </div>

              <label for="cvInput" class="choose-btn">Choose file</label>
            </div>
          </div>
        </div>

        <div>
          <button class="btn w-full mt-2" @click="submit" :disabled="loading">Create account</button>
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

.spinner-top-right {
  position: absolute;
  top: 1rem;   /* tweak to taste */
  right: 2rem; /* tweak to taste */
  z-index: 30;
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

.form-input.plain {
  padding-right: 4.5rem;
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
