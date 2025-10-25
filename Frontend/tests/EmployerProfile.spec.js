// tests/ProfileView.spec.js
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// --- Mocks (do NOT close over test-file variables) ---
// user store mock with internal mutable user and setter helper
vi.mock('@/store/user', () => {
  const user = {
    userID: 'emp-1',
    name: 'Employer One',
    email: 'orig@example.com',
    company: {
      name: 'Orig Company',
      location: 'OrigCity',
      industry: 'Tech'
    }
  }
  return {
    useUserStore: () => ({ user }),
    __setUser: (u) => Object.assign(user, u),
    __getUserRef: () => user
  }
})

// useError mock
vi.mock('@/components/useError', () => {
  const showError = vi.fn()
  return {
    useError: () => ({ showError }),
    __getShowError: () => showError
  }
})

// useSuccess mock
vi.mock('@/components/useSuccess', () => {
  const showSuccess = vi.fn()
  return {
    useSuccess: () => ({ showSuccess }),
    __getShowSuccess: () => showSuccess
  }
})

// Navbar component (simple stub)
vi.mock('@/components/Navbar.vue', () => ({
  default: { template: '<div />' }
}))

// Import the component after mocks so they are applied
import ProfileView from '@/views/Employer/EmployerProfile.vue' // update path to your actual file

describe('Profile view validations', () => {
  let userStoreMod
  let useErrorMod
  let useSuccessMod

  beforeEach(async () => {
    // import mocked modules to access helpers
    userStoreMod = await import('@/store/user')
    useErrorMod = await import('@/components/useError')
    useSuccessMod = await import('@/components/useSuccess')

    // reset user to known defaults
    userStoreMod.__setUser({
      userID: 'emp-1',
      name: 'Employer One',
      email: 'orig@example.com',
      company: {
        name: 'Orig Company',
        location: 'OrigCity',
        industry: 'Tech'
      }
    })

    // clear spies
    useErrorMod.__getShowError().mockClear()
    useSuccessMod.__getShowSuccess().mockClear()
  })

  it('renders initial values from user store', async () => {
    const wrapper = mount(ProfileView, {
      global: { stubs: { Navbar: true } }
    })

    await nextTick()

    const nameInput = wrapper.find('#name')
    const emailInput = wrapper.find('#email')
    const locationInput = wrapper.find('#location')
    const industryInput = wrapper.find('#industry')

    expect(nameInput.element.value).toBe('Orig Company')
    expect(emailInput.element.value).toBe('orig@example.com')
    expect(locationInput.element.value).toBe('OrigCity')
    expect(industryInput.element.value).toBe('Tech')

    await wrapper.unmount()
  })

  it('shows success when clicking save with no changes (password empty allowed)', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useSuccessMod.__getShowSuccess()).toHaveBeenCalledWith('Profile Updated Successfully')
    expect(useErrorMod.__getShowError()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when company name changed to less than 3 chars', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    const nameInput = wrapper.find('#name')
    await nameInput.setValue('A') // too short
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith(
      'Please enter a valid company name (min 3 characters)'
    )
    expect(useSuccessMod.__getShowSuccess()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors on invalid email when changed', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    const emailInput = wrapper.find('#email')
    await emailInput.setValue('not-an-email')
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Please enter a valid email')
    expect(useSuccessMod.__getShowSuccess()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when new password is less than 6 characters', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    await wrapper.find('#password').setValue('123') // too short
    await wrapper.find('#cpassword').setValue('123')
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith(
      'Password must be at least 6 characters long'
    )
    expect(useSuccessMod.__getShowSuccess()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when password and confirm password do not match', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    await wrapper.find('#password').setValue('abcdef')
    await wrapper.find('#cpassword').setValue('abcdeg') // mismatch
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Passwords must match')
    expect(useSuccessMod.__getShowSuccess()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when location changed to less than 6 chars', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    await wrapper.find('#location').setValue('Sml') // less than 6
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith(
      'Please enter a valid location (min 6 characters)'
    )
    expect(useSuccessMod.__getShowSuccess()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when industry changed to less than 3 chars', async () => {
    const wrapper = mount(ProfileView, { global: { stubs: { Navbar: true } } })
    await nextTick()

    await wrapper.find('#industry').setValue('IT') // less than 3
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith(
      'Please enter a valid industry (min 3 characters)'
    )
    expect(useSuccessMod.__getShowSuccess()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })
})
