import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import Navbar from '@/components/Navbar.vue'

// Create a single mock store instance used by the Navbar tests
const mockUserStore = {
  user: { name: 'Alice', userType: 'seeker' }, // include userType
  logout: vi.fn(),
  removeLastViewed: vi.fn()
}

// Mock user state
vi.mock('@/store/user', () => ({
  useUserStore: () => mockUserStore
}))

// mock router + route + RouterLink
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/feed' }), // ensure route.path === '/feed'
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('Navbar.vue', () => {
  let wrapper

  beforeEach(() => {
    mockUserStore.logout.mockClear()
    mockUserStore.removeLastViewed.mockClear()
    mockPush.mockClear()

    wrapper = mount(Navbar, {
      global: {
        stubs: {
          FontAwesomeIcon: { template: '<span />' }
        }
      }
    })
  })

  it('renders the user name from store', () => {
    expect(wrapper.text()).toContain('Alice')
  })

  it('invokes removeLastViewed when Back button clicked', async () => {
    // Back button is only shown when userType === 'seeker' and route.path === '/feed'
    const backBtn = wrapper.find('button[title="Back"]')
    expect(backBtn.exists()).toBe(true)
    await backBtn.trigger('click')
    expect(mockUserStore.removeLastViewed).toHaveBeenCalled()
  })

  it('toggles dropdown and closes on Escape', async () => {
    const profileBtn = wrapper.find('button[title="Profile menu"]')
    await profileBtn.trigger('click')
    // dropdown should now be visible
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('logs out (logout + navigate) when logout pressed', async () => {
    // open dropdown first
    await wrapper.find('button[title="Profile menu"]').trigger('click')
    await nextTick()

    // find the logout button inside the DOM
    const logoutBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Logout')
    expect(logoutBtn, 'Logout button not found in dropdown').toBeTruthy()

    await logoutBtn.trigger('click')

    expect(mockUserStore.logout).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})
