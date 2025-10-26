<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'

// --- State & refs ---
const dropdownOpen = ref(false)
const navRoot = ref(null)
const triggerRef = ref(null)       // anchor button to measure for dropdown placement
const dropdownStyle = ref({})      // dynamic inline style for teleported dropdown

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// --- UI actions ---
function toggleDropdown () { dropdownOpen.value = !dropdownOpen.value }
function closeDropdown () {
  dropdownOpen.value = false
  // cleanup listeners if any remained
  window.removeEventListener('scroll', positionDropdown)
  window.removeEventListener('resize', positionDropdown)
}

function onDocumentClick (e) {
  // Close when clicking outside the navbar area
  if (!navRoot.value) return
  if (!navRoot.value.contains(e.target)) closeDropdown()
}
function onKeydown (e) { if (e.key === 'Escape') closeDropdown() }

function logout () {
  userStore.logout()
  router.push('/')
}

// --- Props / user type ---
const props = defineProps({
  userType: { type: String, default: '' }
})

const effectiveUserType = computed(() => {
  const fromProp = (props.userType || '').toString().trim().toLowerCase()
  const u = userStore?.user || {}
  const fromStore = (u.userType || u.role || '').toString().trim().toLowerCase()
  return fromProp || fromStore || 'seeker'
})

const isEmployer = computed(() => {
  const t = (effectiveUserType.value || '').toString().toLowerCase()
  return t === 'employer' || t.includes('employ') || t === 'company'
})

const routes = computed(() => ({
  profile: isEmployer.value ? '/employer/profile' : '/profile',
  applications: '/applications'
}))

function goTo (key) {
  const to = routes.value[key]
  closeDropdown()
  if (to) router.push(to)
}

// --- Display helpers ---
const displayName = computed(() => {
  const u = userStore?.user || {}
  return isEmployer.value
    ? (u.company?.name || u.name || u.userID || 'User')
    : (u.name || u.company?.name || u.userID || 'User')
})

const displaySub = computed(() => {
  const u = userStore?.user || {}
  return isEmployer.value
    ? (u.company?.location || (u.userType || u.role || '').toString())
    : (u.userType || u.role || u.profile?.location || '')
})

const avatarInitial = computed(() => {
  const name = (displayName.value || 'U').toString().trim()
  return name.charAt(0).toUpperCase()
})

// --- Dropdown positioning (key fix) ---
function positionDropdown () {
  const btn = triggerRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const GAP = 8
  const PANEL_MIN_W = 192 // 12rem, matches w-48

  // base width: at least 12rem, or as wide as trigger
  const panelW = Math.max(rect.width, PANEL_MIN_W)

  // Align right edges (like absolute right-0), clamp to viewport
  let left = rect.right - panelW
  left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8))

  const top = rect.bottom + GAP

  dropdownStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    minWidth: `${Math.round(panelW)}px`,
    zIndex: 2147483647
  }
}

watch(dropdownOpen, async (open) => {
  if (open) {
    await nextTick()
    positionDropdown()
    window.addEventListener('scroll', positionDropdown, { passive: true })
    window.addEventListener('resize', positionDropdown, { passive: true })
  } else {
    window.removeEventListener('scroll', positionDropdown)
    window.removeEventListener('resize', positionDropdown)
  }
})

// --- Lifecycle ---
onMounted(() => {
  document.addEventListener('click', onDocumentClick, { capture: true })
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, { capture: true })
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', positionDropdown)
  window.removeEventListener('resize', positionDropdown)
})
</script>

<template>
  <!-- Always-on-top navbar -->
  <header class="w-full sticky top-0 z-[2147483647] isolate pointer-events-auto">
    <div class="mx-auto max-w-7xl px-3 py-3">
      <div
        class="flex items-center justify-between gap-4 rounded-2xl bg-white/95 backdrop-blur-sm border border-gray-100 shadow-md p-2"
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
              ref="triggerRef"
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

            <!-- Dropdown teleported to body; positioned via inline style -->
            <teleport to="body">
              <transition name="fade-scale" @enter="positionDropdown">
                <div
                  v-if="dropdownOpen"
                  class="origin-top-right fixed rounded-lg bg-white shadow-lg overflow-hidden dropdown"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu"
                  :style="dropdownStyle"
                  @click.stop
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
            </teleport>
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

/* Dropdown (teleported) */
.dropdown {
  border: solid #fff 1px;
  z-index: 2147483647; /* keep above everything */
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
