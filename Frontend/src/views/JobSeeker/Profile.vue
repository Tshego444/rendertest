<script setup>
import Navbar from '@/components/Navbar.vue'
import { ref, computed } from 'vue'
import { useUserStore } from '@/store/user'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'
import { isRequired, minLength, inRange, isEmail } from '@/Utils/Validation'
import axios from 'axios'

const userStore = useUserStore()
const { showError } = useError()
const { showSuccess } = useSuccess()

// Defensive: ensure user and profile exist
const currentUser = userStore.user || {}
const profile = currentUser.profile || { skills: [], experience: '', location: '', age: undefined }

// Split name defensively
const nameParts = (currentUser.name || '').split(' ')
const firstName = ref(nameParts[0] || '')
const surname = ref(nameParts.slice(1).join(' ') || '')

// local editable state
const skills = ref(Array.isArray(profile.skills) ? [...profile.skills] : [])
const newSkill = ref('')
const email = ref(currentUser.email || '')
const location = ref(profile.location || '')
const yearsExp = ref(profile.experience || '')
const password = ref('')
const cpassword = ref('')

const cvFile = ref(null)
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const loading = ref(false)

//Add a new skill to the skills list
function addSkill() {
  const s = (newSkill.value || '').trim()
  if (!s) return
  if (!skills.value.includes(s)) skills.value.push(s)
  newSkill.value = ''
}

//Check if enter button is pushed - if so add skill
function onSkillKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addSkill()
  }
}

//Remove skill from list
function removeSkill(index) {
  skills.value.splice(index, 1)
}

const cvName = computed(() => (cvFile.value ? cvFile.value.name : ''))

//Make sure CV meets all requirements - is not more than 5MB and is a PDF
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

//Process changing PDF upload
function handleFileChange(e) {
  const f = e.target.files?.[0]
  processFile(f)
  // reset input so selecting same file again will trigger change
  e.target.value = ''
}

//Handle a pdf being dropped in input box
function onDrop(e) {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  processFile(f)
}

function onDragOver(e) {
  e.preventDefault()
}

function removeCv() {
  cvFile.value = null
}

//Check if value has changed otherwise no need to process and validate
const hasChanged = (initialVal, newVal) => {
  return initialVal != newVal
}

//Password Validation
const checkPassword = (passwordVal, cpasswordVal) => {
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

function validateBeforeSend() {
  // first name
  if (hasChanged(nameParts[0], firstName.value) && (!isRequired(firstName.value) || !minLength(firstName.value, 3))) {
    showError('Please enter a first name (min 3 characters)')
    return false
  }

  // surname
  if (hasChanged(nameParts.slice(1).join(' '), surname.value) && (!isRequired(surname.value) || !minLength(surname.value, 3))) {
    showError('Please enter a surname (min 3 characters)')
    return false
  }

  // location
  if (hasChanged(profile.location, location.value) && (!isRequired(location.value) || !minLength(location.value, 6))) {
    showError('Please enter a valid location')
    return false
  }

  // experience
  if (hasChanged(profile.experience, yearsExp.value) && (!isRequired(yearsExp.value) || !inRange(yearsExp.value, 1, 60))) {
    showError('Please enter years of experience (1-60)')
    return false
  }

  // email
  if (hasChanged(currentUser.email, email.value) && (!isEmail(email.value))) {
    showError('Please enter a valid email')
    return false
  }

  // password
  if (!checkPassword(password.value, cpassword.value)) return false

  // skills
  if (!Array.isArray(skills.value) || skills.value.length < 3) {
    showError('Please enter at least 3 skills')
    return false
  }

  // CV file validation already handled in processFile
  return true
}

// Build and send the update
const submit = async () => {
  if (!validateBeforeSend()) return

  loading.value = true
  try {
    // determine user id - try id, _id, userID
    const userId = currentUser.id || currentUser._id || currentUser.userID
    if (!userId) {
      showError('Could not identify user ID for update')
      loading.value = false
      return
    }

    const fd = new FormData()

    // name: send firstName/lastName fields to match server
    if (hasChanged(nameParts[0], firstName.value) || hasChanged(nameParts.slice(1).join(' '), surname.value)) {
      fd.append('firstName', firstName.value)
      fd.append('lastName', surname.value)
    }

    // email
    if (hasChanged(currentUser.email, email.value)) {
      fd.append('email', email.value)
    }

    // password (only if provided)
    if (password.value) {
      fd.append('password', password.value)
    }

    // skills (always send to replace)
    fd.append('skills', JSON.stringify(skills.value))

    // experience & location
    if (hasChanged(profile.experience, yearsExp.value)) fd.append('experience', String(yearsExp.value))
    if (hasChanged(profile.location, location.value)) fd.append('location', location.value)

    // CV file
    if (cvFile.value) {
      fd.append('pdf', cvFile.value, cvFile.value.name) // server expects 'pdf'
    }

    // send request with Authorization header
    const token = userStore.token || localStorage.getItem('token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    const resp = await axios.put(`/users/${userId}`, fd, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' }
    })

    // successful update: update store with returned user (server returns new user)
    const updatedUser = resp?.data?.user || resp?.data
    if (!updatedUser) {
      showError('Profile updated but server response was unexpected')
    } else {
      userStore.login(updatedUser)
      showSuccess('Profile Updated Successfully')
    }
  } catch (err) {
    console.error('Profile update error:', err)
    const msg = err?.response?.data || err?.response?.statusText || err?.message || 'Failed to update profile'
    showError(typeof msg === 'string' ? msg : 'Failed to update profile')
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
          <button class="btn w-full mt-2" @click="submit" :disabled="loading">Save Changes</button>
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
