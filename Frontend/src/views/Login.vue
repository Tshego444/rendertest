<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useError } from '@/components/useError'
import api from '@/lib/api'

import Spinner from '@/components/Spinner.vue'

const router = useRouter()
const userStore = useUserStore()
const { showError } = useError()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('') 

const submit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''

  try {
    const res = await api.post('/auth/login', { email: email.value, password: password.value })
    console.log(res)
    const { token, user } = res.data

    // Save token so your api interceptor picks it up
    if (token) localStorage.setItem('token', token)

    // Update your store (adjust if store expects token too)
    userStore.login(user)

    // Route based on user type if you want the same behaviour as your mock:
    if (user.userType === 'seeker') router.push('/feed')
    else if (user.userType === 'employer') router.push('/dashboard')
    else if (user.userType === 'admin') router.push('/admin')
  } catch (err) {
    // show helpful error
    if (err?.response?.data) {
      error.value = err.response.data.message || err.response.data || 'Login failed'
    } else {
      error.value = err.message || 'Network error'
    }
    showError(error.value)
  } finally {
    loading.value = false
  }
}
</script>


<template>
  <div class="w-full max-w-md mx-auto p-4 mainview">
    <div class="card relative">
      <!-- 🔹 Spinner positioned in top-right corner -->
      <div v-if="loading" class="absolute top-5 right-5 z-20">
        <Spinner size="26" color="#3b82f6" />
      </div>

      <RouterLink to="/" class="back-arrow m-0.5">
        <FontAwesomeIcon icon="arrow-left" class="text-lg mb-2 text-black" />
      </RouterLink>

      <div class="text-center mb-10">
        <h1 class="text-4xl font-bold text-gray-800 tracking-tighter">JobSeekr</h1>
        <p class="text-gray-500 mt-2">Find your next opportunity.</p>
      </div>

      <div class="space-y-6">
        <div>
          <input
            v-model="email"
            class="form-input w-full"
            id="email"
            placeholder="Email"
            type="email"
            autocomplete="email"
          />
        </div>
        <div>
          <input
            v-model="password"
            class="form-input w-full"
            id="password"
            placeholder="Password"
            type="password"
            autocomplete="current-password"
          />
        </div>

        <div>
          <button
            class="btn w-full mt-4"
            @click="submit"
            :disabled="loading"
          > Log In
          </button>
        </div>

        <div class="text-center mt-8">
          <p class="text-gray-600">
            Don't have an account?
            <RouterLink class="link" to="/signup">Sign up</RouterLink>
          </p>
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
  border-radius: 2rem;
  box-shadow:
    0 10px 25px -5px var(--shadow-color),
    0 10px 10px -5px var(--shadow-color);
  padding: 2.5rem;
  position: relative;
  overflow: hidden;
}

/* inputs */
.form-input {
  background-color: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 1rem;
  padding: 1rem;
  transition: border-color 0.3s ease-in-out;
  color: var(--mediumBlue);
}
.form-input:focus {
  outline: none;
  border-color: var(--mediumBlue);
}

/* buttons */
.btn {
  border-radius: 1rem;
  cursor: pointer;
  background-color: var(--darkBlue);
  color: white;
  padding: 1rem;
  font-weight: 600;
  transition:
    background-color 0.3s ease-in-out,
    box-shadow 0.2s ease;
}
.btn:hover {
  background-color: var(--mediumBlue);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* links */
.link {
  color: var(--mediumBlue);
  font-weight: 500;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

.back-arrow {
  font-size: 20px;
  color: #adadad;
}
</style>
