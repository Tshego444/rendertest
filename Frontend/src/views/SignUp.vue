<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { ref } from 'vue'
import { isEmail, minLength } from '@/Utils/Validation'
import { useError } from '@/components/useError'

const { showError } = useError()
const accountType = ref(0)
const router = useRouter()

const email = ref('')
const password = ref('')

const select = (st) => {
  accountType.value = st
}

// Validate email and password and then move to the next page
const submit = () => {
  if(!isEmail(email.value)){
    showError('Invalid email')
    return
  }

  if(!minLength(password.value, 6)){
    showError('Password must be atleast 6 characters long')
    return
  }

  const routePath = accountType.value === 0 ? '/seekersignup' : '/employersignup'

  router.push({
    path: routePath,
    state: {
      email: email.value,
      password: password.value
    }
  })
  
}
</script>

<template>
  <div class="bg w-full max-w-md mx-auto p-4 mainview">
    <div class="card">
      <RouterLink to="/" class="back-arrow m-0.5"
        ><FontAwesomeIcon icon="arrow-left" class="text-lg mb-2"
      /></RouterLink>
      <div class="text-center mb-10">
        <h1 class="text-4xl font-bold text-gray-800 tracking-tighter">Create an Account</h1>
        <p class="text-gray-500 mt-2">Find your next opportunity.</p>
      </div>
      <div class="accountType grid grid-cols-2">
        <button @click="select(0)" :class="{ selected: accountType === 0 }" class="btnSelect">
          Job Seeker
        </button>
        <button @click="select(1)" :class="{ selected: accountType === 1 }" class="btnSelect">
          Employer
        </button>
      </div>
      <div class="space-y-6">
        <div>
          <label class="sr-only" for="email">Email</label>
          <input v-model="email" class="form-input w-full" id="email" placeholder="Email" type="email" />
        </div>
        <div>
          <label class="sr-only" for="password">Password</label>
          <input v-model="password" class="form-input w-full" id="password" placeholder="Password" type="password" />
        </div>
        <div>
          <button class="btn w-full mt-4" @click="submit">Sign Up</button>
        </div>
        <div class="text-center mt-8">
          <p class="text-gray-600">
            Already have an account? <RouterLink class="link" to="/login">Log In</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg {
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

.accountType {
  border: 2px solid #e0e0e0;
  border-radius: 1rem;
  margin-bottom: 1.5rem;
}

.selected {
  background-color: var(--mediumBlue);
  border-radius: 1rem;
  color: #fff;
}

.btnSelect {
  border-radius: 1rem;
  padding: 0.2rem;
  cursor: pointer;
}
</style>
