<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'

// Dropdown state
const dropdownOpen = ref(false)
// Reference to nav root element
const navRoot = ref(null)
// Router and current route
const router = useRouter()
const route = useRoute()
// User store for authentication and data
const userStore = useUserStore()

// Toggle dropdown open/close
function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

// Close dropdown
function closeDropdown() {
  dropdownOpen.value = false
}

// Close dropdown if clicked outside nav
function onDocumentClick(e) {
  if (!navRoot.value) return
  if (!navRoot.value.contains(e.target)) closeDropdown()
}

// Close dropdown on Escape key
function onKeydown(e) {
  if (e.key === 'Escape') closeDropdown()
}

// Logout user and redirect home
function logout() {
  userStore.logout()
  router.push('/')
}

// Accept optional userType prop
const props = defineProps({
  userType: {
    type: String,
    default: ''
  }
})

// Determine user type (normalized, defensive)
const effectiveUserType = computed(() => {
  // Priority: prop -> store.user.userType -> store.user.role -> default 'seeker'
  const fromProp = (props.userType || '').toString().trim().toLowerCase()
  const storeUser = userStore?.user || {}
  const fromStore = (storeUser.userType || storeUser.role || '').toString().trim().toLowerCase()
  return fromProp || fromStore || 'seeker'
})

// Determine if this user is employer
const isEmployer = computed(() => {
  const t = (effectiveUserType.value || '').toString().toLowerCase()
  return t === 'employer' || t.includes('employ') || t === 'company'
})

// Routes differ for employer vs seeker
const routes = computed(() => {
  return {
    profile: isEmployer.value ? '/employer/profile' : '/profile',
    applications: '/applications'
  }
})

// Navigate to route key and close dropdown
function goTo(key) {
  const to = routes.value[key]
  if (!to) return closeDropdown()
  closeDropdown()
  router.push(to)
}

// Display name (seeker => user.name, employer => user.company.name)
const displayName = computed(() => {
  const u = userStore?.user || {}
  // Employer: prefer company.name
  if (isEmployer.value) {
    return u.company?.name || u.name || u.userID || 'User'
  }
  // Seeker or default: prefer name
  return u.name || u.company?.name || u.userID || 'User'
})

// Sub line under name (small text) - show type or company location if available
const displaySub = computed(() => {
  const u = userStore?.user || {}
  if (isEmployer.value) {
    // show company location if available, otherwise userType
    return u.company?.location || (u.userType || u.role || '').toString()
  }
  // seeker: show userType or location if in profile
  return u.userType || u.role || u.profile?.location || ''
})

// Avatar initial from displayName (first char uppercase)
const avatarInitial = computed(() => {
  const name = (displayName.value || 'U').toString().trim()
  return name.charAt(0).toUpperCase()
})

// Add global event listeners on mount
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

// Remove listeners on unmount
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>


<template>
  <header class="w-full">
    <div class="mx-auto max-w-7xl px-3 py-3">
      <div
        class="flex items-center justify-between gap-4 rounded-2xl bg-white backdrop-blur-sm border border-gray-100 shadow-md p-2"
      >
        <!-- Brand -->
        <RouterLink to="/feed" class="flex items-center gap-3 no-underline">
          <div class="leading-tight pl-3">
            <h1 class="text-lg md:text-2xl font-extrabold tracking-tight text-slate-800">JobSeekr</h1>
            <p class="text-xs text-slate-500 -mt-0.5 hidden md:block">Find your next role</p>
          </div>
        </RouterLink>

        <!-- Actions -->
        <div class="flex items-center gap-2 ml-auto">
          <!-- Undo (show only when seeker on /feed) -->

          <!-- Messages -->
          <RouterLink
            v-if="userStore.user.userType == 'seeker' || userStore.user.userType == 'employer'"
            to="/message"
            class="btn action-btn"
            title="Messages"
          >
            <FontAwesomeIcon icon="message" class="text-xl" />
            <span class="sr-only">Messages</span>
          </RouterLink>

          <!-- Profile / Dropdown -->
          <div class="relative" ref="navRoot">
            <button
              @click.prevent="toggleDropdown"
              :aria-expanded="dropdownOpen"
              class="flex items-center gap-3 btn profile-btn"
              title="Profile menu"
            >
              <!-- Avatar circle with initial -->
              <div class="avatar">
                <span class="avatar-initial">{{ avatarInitial }}</span>
              </div>

              <div class="hidden md:block text-left">
                <div class="text-sm font-medium text-slate-800 leading-none truncate" style="max-width: 10rem;">
                  {{ displayName }}
                </div>
                <div class="text-xs text-slate-500 truncate" style="max-width: 10rem;">
                  {{ displaySub }}
                </div>
              </div>

              <!-- chevron -->
              <FontAwesomeIcon class="text-lg" icon="caret-down" />
            </button>

            <transition name="fade-scale">
              <div
                v-if="dropdownOpen"
                class="origin-top-right absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg overflow-hidden dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="user-menu"
              >
                <button
                  v-if="userStore.user.userType == 'seeker' || userStore.user.userType == 'employer'"
                  @click="goTo('profile')"
                  class="block w-full text-left px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer"
                  role="menuitem"
                >
                  Profile
                </button>

                <button
                  v-if="userStore.user.userType == 'seeker'"
                  @click="goTo('applications')"
                  class="block w-full text-left px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer"
                  role="menuitem"
                >
                  Applications
                </button>

                <div class="border-t border-slate-100"></div>

                <button
                  @click="logout"
                  class="block w-full text-left px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer"
                  role="menuitem"
                >
                  Logout
                </button>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Base button */
.btn {
  cursor: pointer;
  margin: 0 0.25rem;
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform .12s ease, box-shadow .12s ease;
}

.dropdown {
  border: solid #fff 1px;
  z-index: 9999;
}

/* Small action buttons (icons) */
.action-btn {
  padding: 0.5rem;
  border-radius: 0.6rem;
  background: transparent;
}
.action-btn:hover {
  transform: translateY(-2px);
  background: rgba(15, 23, 42, 0.03);
}

/* Profile button */
.profile-btn {
  padding: 0.35rem 0.6rem;
  border-radius: 0.9rem;
  gap: 0.6rem;
}
.profile-btn:hover {
  background: rgba(15, 23, 42, 0.03);
  transform: translateY(-1px);
}

/* Avatar circle */
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 0.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /*background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%); */
  background-color: var(--darkBlue);
  box-shadow: 0 4px 10px rgba(99,102,241,0.12);
  color: white;
  font-weight: 700;
}
.avatar-initial {
  display: inline-block;
  font-size: 1rem;
  line-height: 1;
}

/* Dropdown transition */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: transform 160ms cubic-bezier(.2,.9,.3,1), opacity 160ms ease;
}
.fade-scale-enter-from {
  transform: translateY(-6px) scale(.98);
  opacity: 0;
}
.fade-scale-enter-to {
  transform: translateY(0) scale(1);
  opacity: 1;
}
.fade-scale-leave-from {
  transform: translateY(0) scale(1);
  opacity: 1;
}
.fade-scale-leave-to {
  transform: translateY(-6px) scale(.98);
  opacity: 0;
}

/* small responsiveness */
@media (max-width: 640px) {
  .avatar { width: 36px; height: 36px; }
  .profile-btn { padding: 0.25rem 0.45rem; }
}
</style>
