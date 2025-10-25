// tests/UsersAdmin.spec.js
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// ----------------- Safe module mocks -----------------
// Mock users DB JSON (provide default export)
vi.mock('@/data/usersDB.json', () => {
  return {
    default: [
      // seeker
      {
        userID: 'u-seeker-1',
        userType: 'seeker',
        name: 'Alice Seeker',
        email: 'alice@seek.com',
        profile: {
          skills: ['Vue', 'JS'],
          experience: '3',
          location: 'Cape Town',
          cv: 'alice.pdf'
        }
      },
      // employer
      {
        userID: 'u-employer-1',
        userType: 'employer',
        name: 'Bob Employer',
        email: 'bob@empl.com',
        company: {
          name: 'BobCo',
          location: 'Sandton',
          industry: 'Tech'
        }
      },
      // admin
      {
        userID: 'admin-1',
        userType: 'admin',
        name: 'Main Admin',
        email: 'admin@example.com'
      }
    ]
  }
})

// Mock Navbar component so mount doesn't require real file
vi.mock('@/components/Navbar.vue', () => ({ default: { template: '<div />' } }))

// Mock useError composable
vi.mock('@/components/useError', () => {
  const showError = vi.fn()
  return {
    useError: () => ({ showError }),
    __getShowError: () => showError
  }
})

// Mock useSuccess composable
vi.mock('@/components/useSuccess', () => {
  const showSuccess = vi.fn()
  return {
    useSuccess: () => ({ showSuccess }),
    __getShowSuccess: () => showSuccess
  }
})

// Mock user store with mutable current user and setter helper
vi.mock('@/store/user', () => {
  const user = {
    userID: 'admin-1',
    name: 'Main Admin',
    email: 'admin@example.com',
    userType: 'admin'
  }
  return {
    useUserStore: () => ({ user }),
    __setUser: (u) => Object.assign(user, u),
    __getUserRef: () => user
  }
})

// Mock FontAwesomeIcon used in template by stubbing globally in mount options (no module mock needed)

// ----------------- Import component AFTER mocks -----------------
// <-- Update this path if your component file lives elsewhere -->
import UsersAdmin from '@/views/Admin/AdminHome.vue'

describe('Users admin view', () => {
  let useErrorMod
  let useSuccessMod
  let userStoreMod

  beforeEach(async () => {
    // clear localStorage between tests
    localStorage.removeItem('users_db_admin')

    // import mocks to access helper spies
    useErrorMod = await import('@/components/useError')
    useSuccessMod = await import('@/components/useSuccess')
    userStoreMod = await import('@/store/user')

    useErrorMod.__getShowError().mockClear()
    useSuccessMod.__getShowSuccess().mockClear()
  })

  it('loads users from static file when localStorage is empty and shows rows', async () => {
    const wrapper = mount(UsersAdmin, {
      global: {
        stubs: {
          FontAwesomeIcon: true,
          Navbar: true
        }
      }
    })
    // onMounted runs - wait for it
    await nextTick()
    await nextTick()

    // The three sample users should be present (roleFilter default = 'All')
    expect(wrapper.text()).toContain('Alice Seeker')
    expect(wrapper.text()).toContain('Bob Employer')
    expect(wrapper.text()).toContain('Main Admin')

    // "Loading users..." should not be present
    expect(wrapper.text()).not.toContain('Loading users...')

    await wrapper.unmount()
  })

  it('filters users via searchTerm (name / email / id)', async () => {
    const wrapper = mount(UsersAdmin, {
      global: {
        stubs: { FontAwesomeIcon: true, Navbar: true }
      }
    })
    await nextTick()
    await nextTick()

    // find the search input by placeholder text
    const searchInput = wrapper.find('input[placeholder="Search users by name, email or ID"]')
    expect(searchInput.exists()).toBe(true)

    // search by name
    await searchInput.setValue('Alice')
    await nextTick()

    expect(wrapper.text()).toContain('Alice Seeker')
    expect(wrapper.text()).not.toContain('Bob Employer')

    // search by id
    await searchInput.setValue('admin-1')
    await nextTick()
    expect(wrapper.text()).toContain('Main Admin')
    expect(wrapper.text()).not.toContain('Alice Seeker')

    await wrapper.unmount()
  })

  it('filters users by role tab', async () => {
    const wrapper = mount(UsersAdmin, {
      global: {
        stubs: { FontAwesomeIcon: true, Navbar: true }
      }
    })
    await nextTick()
    await nextTick()

    const buttons = wrapper.findAll('button')
    // role tab buttons exist (All, seeker, employer, admin) — find the "seeker" one
    const seekerBtn = buttons.find(b => b.text() === 'seeker')
    expect(seekerBtn).toBeTruthy()

    await seekerBtn.trigger('click')
    await nextTick()

    // Only seeker displayed
    expect(wrapper.text()).toContain('Alice Seeker')
    expect(wrapper.text()).not.toContain('Bob Employer')
    expect(wrapper.text()).not.toContain('Main Admin')

    // switch to employer tab
    const employerBtn = buttons.find(b => b.text() === 'employer')
    await employerBtn.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Bob Employer')
    expect(wrapper.text()).not.toContain('Alice Seeker')

    await wrapper.unmount()
  })

  it('openEditModal populates editForm correctly for seeker and employer and shows modal', async () => {
    const wrapper = mount(UsersAdmin, {
      global: { stubs: { FontAwesomeIcon: true, Navbar: true } }
    })
    await nextTick()
    await nextTick()

    // call openEditModal for a seeker (from sample data)
    const seeker = (await import('@/data/usersDB.json')).default.find(u => u.userType === 'seeker')
    expect(seeker).toBeTruthy()

    // call the exported setup function via vm
    await wrapper.vm.openEditModal(seeker)
    await nextTick()

    // modal should be visible (v-if editModalOpen)
    expect(wrapper.find('h3').text()).toBe('Edit user')
    // check seeker-specific fields populated on form object
    expect(wrapper.vm.editForm.userID).toBe(seeker.userID)
    expect(wrapper.vm.editForm.name).toBe(seeker.name)
    expect(wrapper.vm.editForm.profile_skills_csv).toContain('Vue')
    expect(wrapper.vm.editForm.profile_location).toBe('Cape Town')

    // close modal
    await wrapper.vm.closeEditModal()
    await nextTick()
    expect(wrapper.find('h3').exists()).toBe(false)

    // open for employer and validate company fields
    const employer = (await import('@/data/usersDB.json')).default.find(u => u.userType === 'employer')
    await wrapper.vm.openEditModal(employer)
    await nextTick()
    expect(wrapper.vm.editForm.company_name).toBe(employer.company.name)
    expect(wrapper.vm.editForm.company_industry).toBe(employer.company.industry)

    await wrapper.unmount()
  })

  it('saveEdit validates missing userID and missing name/email, and succeeds when valid', async () => {
    const wrapper = mount(UsersAdmin, {
      global: { stubs: { FontAwesomeIcon: true, Navbar: true } }
    })
    await nextTick()
    await nextTick()

    // Case 1: missing userID
    wrapper.vm.editForm.userID = ''
    wrapper.vm.editForm.name = 'X'
    wrapper.vm.editForm.email = 'x@x.com'
    await wrapper.vm.saveEdit()
    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Missing user ID.')

    useErrorMod.__getShowError().mockClear()

    // Case 2: missing name/email
    wrapper.vm.editForm.userID = 'u-seeker-1' // exists
    wrapper.vm.editForm.name = ''
    wrapper.vm.editForm.email = ''
    await wrapper.vm.saveEdit()
    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Name and email are required.')

    useErrorMod.__getShowError().mockClear()

    // Case 3: user not found
    wrapper.vm.editForm.userID = 'nonexistent'
    wrapper.vm.editForm.name = 'Name'
    wrapper.vm.editForm.email = 'e@e.com'
    await wrapper.vm.saveEdit()
    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('User not found.')

    useErrorMod.__getShowError().mockClear()

    // Case 4: success — set an existing user id and valid name/email
    wrapper.vm.editForm.userID = 'u-employer-1'
    wrapper.vm.editForm.name = 'Bob Employer Edited'
    wrapper.vm.editForm.email = 'bob@edited.com'
    // ensure modal open so saveEdit will close it
    wrapper.vm.editModalOpen = true
    await wrapper.vm.saveEdit()
    expect(useSuccessMod.__getShowSuccess()).toHaveBeenCalledWith('User saved.')
    // modal should be closed
    expect(wrapper.vm.editModalOpen).toBe(false)

    await wrapper.unmount()
  })

  it('confirmRemove prevents deleting currently logged admin and deletes when confirmed', async () => {
    const wrapper = mount(UsersAdmin, {
      global: { stubs: { FontAwesomeIcon: true, Navbar: true } }
    })
    await nextTick()
    await nextTick()

    // current logged in admin per mock: admin-1
    const adminUser = (await import('@/data/usersDB.json')).default.find(u => u.userType === 'admin')
    expect(adminUser.userID).toBe('admin-1')

    // calling confirmRemove with same id should call showError and not call confirm dialog
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    wrapper.vm.confirmRemove(adminUser)
    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('You cannot remove the currently logged in admin.')
    // window.confirm should not be called because early return
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
    useErrorMod.__getShowError().mockClear()

    // For non-current user, simulate OK from confirm dialog
    const seeker = (await import('@/data/usersDB.json')).default.find(u => u.userType === 'seeker')
    const confirmOk = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    wrapper.vm.confirmRemove(seeker)
    expect(useSuccessMod.__getShowSuccess()).toHaveBeenCalledWith('User deleted.')
    confirmOk.mockRestore()

    await wrapper.unmount()
  })
})
