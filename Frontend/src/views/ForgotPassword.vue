<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useError } from '@/components/useError'
import { useSuccess } from '@/components/useSuccess'
import { isEmail } from '@/Utils/Validation'

const router = useRouter()
const { showError } = useError()
const { showSuccess } = useSuccess()

const email = ref('')

const submit = () => {
    if (!isEmail(email.value)){
        showError('Please enter a valid email')
    } else {
        showSuccess('Email sent')
        router.push('/login')
    }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto p-4 mainview">
    <div class="card">
      <RouterLink to="/login" class="back-arrow m-0.5">
        <FontAwesomeIcon icon="arrow-left" class="text-lg mb-2 text-black" />
      </RouterLink>

      <div class="text-center mb-10">
        <h1 class="text-4xl font-bold text-gray-800 tracking-tighter">Forgot Password</h1>
        <p class="text-gray-500 mt-2">Enter your email and a reset password will be sent to you.</p>
      </div>
      <div class="space-y-6">
        <div>
          <label class="sr-only" for="email">Email</label>
          <input
            v-model="email"
            class="form-input w-full"
            id="email"
            placeholder="Email"
            type="email"
          />
        </div>
        <div>
          <button class="btn w-full mt-4" @click="submit">Reset Password</button>
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
}
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

.link {
  color: var(--mediumBlue);
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

.back-arrow {
  font-size: 20px;
  font-weight: 100;
  color: #adadad;
}
</style>