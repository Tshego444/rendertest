import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SignUp from '@/views/SignUp.vue'

// Create mocks 
const mockPush = vi.fn()
const mockShowError = vi.fn()
const mockIsEmail = vi.fn()
const mockMinLength = vi.fn()

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>' }
}))

// Mock validation utilities
vi.mock('@/Utils/Validation', () => ({
  isEmail: (...args) => mockIsEmail(...args),
  minLength: (...args) => mockMinLength(...args)
}))

// Mock useError
vi.mock('@/components/useError', () => ({
  useError: () => ({ showError: mockShowError })
}))

describe('SignUp.vue', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockShowError.mockClear()
    mockIsEmail.mockReset()
    mockMinLength.mockReset()
    mockIsEmail.mockReturnValue(true)
    mockMinLength.mockReturnValue(true)
  })

  function mountComponent() {
    return mount(SignUp, {
      global: {
        stubs: {
          FontAwesomeIcon: { template: '<span />' }
        }
      }
    })
  }

  it('renders email and password inputs and buttons', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('input#email').exists()).toBe(true)
    expect(wrapper.find('input#password').exists()).toBe(true)

    const accountBtns = wrapper.findAll('button.btnSelect')
    expect(accountBtns.length).toBe(2)

    expect(wrapper.find('button.btn').exists()).toBe(true)
  })

  it('initially selects "Job Seeker"', () => {
    const wrapper = mountComponent()
    const accountBtns = wrapper.findAll('button.btnSelect')

    expect(accountBtns[0].classes()).toContain('selected')
    expect(accountBtns[1].classes()).not.toContain('selected')
  })

  it('toggles account type when clicked', async () => {
    const wrapper = mountComponent()
    const accountBtns = wrapper.findAll('button.btnSelect')

    await accountBtns[1].trigger('click')
    expect(accountBtns[1].classes()).toContain('selected')
    expect(accountBtns[0].classes()).not.toContain('selected')

    await accountBtns[0].trigger('click')
    expect(accountBtns[0].classes()).toContain('selected')
  })

  it('shows error if email is invalid', async () => {
    mockIsEmail.mockReturnValue(false)

    const wrapper = mountComponent()

    await wrapper.find('#email').setValue('bad')
    await wrapper.find('#password').setValue('goodpassword')
    await wrapper.find('button.btn').trigger('click')

    expect(mockShowError).toHaveBeenCalledWith('Invalid email')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error if password is too short', async () => {
    mockMinLength.mockReturnValue(false)

    const wrapper = mountComponent()

    await wrapper.find('#email').setValue('test@example.com')
    await wrapper.find('#password').setValue('123')
    await wrapper.find('button.btn').trigger('click')

    expect(mockShowError).toHaveBeenCalledWith('Password must be atleast 6 characters long')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('navigates when inputs are valid', async () => {
    const wrapper = mountComponent()

    await wrapper.find('#email').setValue('valid@example.com')
    await wrapper.find('#password').setValue('longenough')
    await wrapper.find('button.btn').trigger('click')

    expect(mockShowError).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/seekersignup')
  })
})
