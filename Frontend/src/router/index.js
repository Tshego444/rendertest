import { createRouter, createWebHistory } from 'vue-router'

import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'
import SignUp from '@/views/SignUp.vue'
import SeekerSignUp from '@/views/JobSeeker/SeekerSignUp.vue'
import Feed from '@/views/JobSeeker/Feed.vue'
import Profile from '@/views/JobSeeker/Profile.vue'
import Applications from '@/views/JobSeeker/Applications.vue'
import Message from '@/views/Message.vue'
import { useUserStore } from '@/store/user'
import ForgotPassword from '@/views/ForgotPassword.vue'
import Dashboard from '@/views/Employer/Dashboard.vue'
import EmployerProfile from '@/views/Employer/EmployerProfile.vue'
import Create from '@/views/Employer/Create.vue'
import EmployerApplications from '@/views/Employer/EmployerApplications.vue'
import AdminHome from '@/views/Admin/AdminHome.vue'
import EmployerCreateAccount from '@/views/Employer/EmployerCreateAccount.vue'

//All routes available
const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/forgotpassword', name: 'ForgotPassword', component: ForgotPassword },
  { path: '/signup', name: 'SignUp', component: SignUp },
  { path: '/seekersignup', name: 'seekersignup', component: SeekerSignUp },
  { path: '/employersignup', name: 'employersignup', component: EmployerCreateAccount },

  //Seeker
  {
    path: '/feed',
    name: 'seekerfeed',
    component: Feed,
    meta: { requiresAuth: true, userType: 'seeker' },
  },
  {
    path: '/profile',
    name: 'seekerprofile',
    component: Profile,
    meta: { requiresAuth: true, userType: 'seeker' },
  },
  {
    path: '/applications',
    name: 'seekerapplications',
    component: Applications,
    meta: { requiresAuth: true, userType: 'seeker' },
  },
  {
    path: '/message',
    name: 'message',
    component: Message,
    meta: { requiresAuth: true },
  },
  {
    path: '/message/:id',
    name: 'messagenew',
    component: Message,
    meta: { requiresAuth: true, userType: 'employer' },
  },

  //Employers:
  { 
    path: '/dashboard', 
    name: 'Dashboard', 
    component: Dashboard, 
    meta: { requiresAuth: true, userType: 'employer' } 
  },
  { 
    path: '/employer/profile', 
    name: 'EmployerProfile', 
    component: EmployerProfile, 
    meta: { requiresAuth: true, userType: 'employer' } 
  },
  { 
    path: '/employer/create', 
    name: 'EmployerCreate', 
    component: Create, 
    meta: { requiresAuth: true, userType: 'employer' } 
  },
  { 
    path: '/employer/listing/:id', 
    name: 'EmployerEdit', 
    component: Create, 
    meta: { requiresAuth: true, userType: 'employer' } 
  },
  { 
    path: '/employer/applications/:id', 
    name: 'EmployerApplications', 
    component: EmployerApplications, 
    meta: { requiresAuth: true, userType: 'employer' } 
  },

  // Admin
  { 
    path: '/admin', 
    name: 'AdminHome', 
    component: AdminHome, 
    meta: { requiresAuth: true, userType: 'admin' } 
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Authentication function that ensures users cannot access restricted pages
router.beforeEach((to, from, next) => {
  const userStore = useUserStore() // Access user store
  const user = userStore.user // Current logged-in user

  // Pages that do not require authentication
  const publicPages = ['Home', 'Login', 'SignUp', 'ForgotPassword']

  // Prevent logged-in users from going back to public pages
  if (user && publicPages.includes(to.name)) {
    if (user.userType === 'seeker') return next({ name: 'seekerfeed' })
    if (user.userType === 'employer') return next({ name: 'Dashboard' })
    if (user.userType === 'admin') return next({ name: 'AdminHome' })
  }

  // Check if page requires authentication
  if (to.meta && to.meta.requiresAuth) {
    if (!user) return next({ name: 'Login' }) // Redirect if not logged in
    if (to.meta.userType && to.meta.userType !== user.userType) {
      return next({ name: 'Home' }) // Redirect if wrong user type
    }
  }

  // Allow navigation
  next()
})

export default router
