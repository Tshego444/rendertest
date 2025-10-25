import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock user state
const initialUser = {
  userID: 'u1',
  name: 'John Smith',
  email: 'john@example.com',
  profile: {
    skills: ['Vue', 'JS', 'CSS'],
    location: 'Cape Town',
    experience: 5
  }
}

vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    user: { ...initialUser },
    logout: vi.fn(),
    removeLastViewed: vi.fn()
  })
}))

// mock showError / showSuccess
const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()
vi.mock('@/components/useError', () => ({
  useError: () => ({ showError: mockShowError })
}))
vi.mock('@/components/useSuccess', () => ({
  useSuccess: () => ({ showSuccess: mockShowSuccess })
}))

const mockIsRequired = vi.fn((v) => {
  return v !== undefined && v !== null && String(v).trim() !== ''
})
const mockMinLength = vi.fn((v, n) => typeof v === 'string' && v.trim().length >= n)
const mockInRange = vi.fn((v, a, b) => {
  const num = Number(v)
  if (Number.isNaN(num)) return false
  return num >= a && num <= b
})
const mockIsEmail = vi.fn((v) => {
  return typeof v === 'string' && /\S+@\S+\.\S+/.test(v)
})
vi.mock('@/Utils/Validation', () => ({
  isRequired: (...args) => mockIsRequired(...args),
  minLength: (...args) => mockMinLength(...args),
  inRange: (...args) => mockInRange(...args),
  isEmail: (...args) => mockIsEmail(...args)
}))

import Profile from '@/views/JobSeeker/Profile.vue'

function setInputFiles(fileInputWrapper, filesArray) {
  const el = fileInputWrapper.element
  const fileList = Array.from(filesArray)
  fileList.item = (i) => fileList[i]
  Object.defineProperty(el, 'files', {
    value: fileList,
    writable: false,
    configurable: true
  })
}

describe('Profile page', () => {
  let wrapper

  function mountComponent() {
    return mount(Profile, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' }
        }
      }
    })
  }

  beforeEach(() => {
    wrapper = mountComponent()
    mockShowError.mockClear()
    mockShowSuccess.mockClear()
    mockIsRequired.mockClear()
    mockMinLength.mockClear()
    mockInRange.mockClear()
    mockIsEmail.mockClear()
  })

  it('renders the key form fields', () => {
    expect(wrapper.find('#fname').exists()).toBe(true)
    expect(wrapper.find('#sname').exists()).toBe(true)
    expect(wrapper.find('#location').exists()).toBe(true)
    expect(wrapper.find('#experience').exists()).toBe(true)
    expect(wrapper.find('#email').exists()).toBe(true)
    expect(wrapper.find('#skillInput').exists()).toBe(true)
    expect(wrapper.find('#cvInput').exists()).toBe(true)
    expect(wrapper.find('#password').exists()).toBe(true)
    expect(wrapper.find('#cpassword').exists()).toBe(true)
  })

  it('adds and removes skills', async () => {
    const skillInput = wrapper.find('#skillInput')
    await skillInput.setValue('TestingSkill')
    await wrapper.find('.add-skill-btn').trigger('click')

    expect(wrapper.text()).toContain('TestingSkill')

    // remove it
    const removeBtns = wrapper.findAll('button.skill-remove')
    const chips = wrapper.findAll('.skill-chip')
    const idx = chips.findIndex(ch => ch.text().includes('TestingSkill'))
    expect(idx).toBeGreaterThanOrEqual(0)
    await removeBtns[idx].trigger('click')

    expect(wrapper.text()).not.toContain('TestingSkill')
  })

  it('rejects non-PDF file upload', async () => {
    const fileInputWrapper = wrapper.find('#cvInput')
    const badFile = new File(['hello'], 'file.txt', { type: 'text/plain' })
    setInputFiles(fileInputWrapper, [badFile])

    await fileInputWrapper.trigger('change')

    expect(mockShowError).toHaveBeenCalledWith('Unsupported file type. Please upload PDF only')
  })

  it('rejects file over 5MB', async () => {
    const fileInputWrapper = wrapper.find('#cvInput')
    // create a ~6MB blob
    const bigBlob = new Uint8Array(6 * 1024 * 1024)
    const bigFile = new File([bigBlob], 'big.pdf', { type: 'application/pdf' })
    setInputFiles(fileInputWrapper, [bigFile])

    await fileInputWrapper.trigger('change')

    expect(mockShowError).toHaveBeenCalledWith('File is too large. Maximum allowed size is 5 MB.')
  })

  it('removes uploaded CV', async () => {
    const fileInputWrapper = wrapper.find('#cvInput')
    const pdf = new File([new Uint8Array(1024)], 'resume.pdf', { type: 'application/pdf' })
    setInputFiles(fileInputWrapper, [pdf])
    await fileInputWrapper.trigger('change')

    // file name should appear
    expect(wrapper.find('.file-name').exists()).toBe(true)
    await wrapper.find('button.remove-cv').trigger('click')
    expect(wrapper.find('.file-name').exists()).toBe(false)
  })

  it('shows error if password too short when provided', async () => {
    // provide a short password and matching confirm
    await wrapper.find('#password').setValue('123')
    await wrapper.find('#cpassword').setValue('123')
    await wrapper.find('.btn').trigger('click')

    expect(mockShowError).toHaveBeenCalledWith('Password must be atleast 6 characters long')
  })

  it('shows error if passwords do not match', async () => {
    await wrapper.find('#password').setValue('longenough')
    await wrapper.find('#cpassword').setValue('different')
    await wrapper.find('.btn').trigger('click')

    expect(mockShowError).toHaveBeenCalledWith('Passwords must match')
  })

  it('shows error when email changed to invalid value', async () => {
    // change email to an invalid email
    await wrapper.find('#email').setValue('not-an-email')
    await wrapper.find('.btn').trigger('click')

    expect(mockShowError).toHaveBeenCalledWith('Please enter a valid email')
  })

  it('shows error when fewer than 3 skills exist', async () => {
    // Remove skills until fewer than 3
    const removeBtns = wrapper.findAll('button.skill-remove')
    // initial skills are 3 - remove two to leave 1
    if (removeBtns.length >= 2) {
      await removeBtns[0].trigger('click')
      const removeBtns2 = wrapper.findAll('button.skill-remove')
      if (removeBtns2.length > 0) await removeBtns2[0].trigger('click')
    }

    await wrapper.find('.btn').trigger('click')

    expect(mockShowError).toHaveBeenCalledWith('Please enter atleast 3 skills')
  })

  it('submits successfully when nothing changed and skills >=3', async () => {
    // initial data matches store + no password provided + skills already >=3
    await wrapper.find('.btn').trigger('click')

    expect(mockShowError).not.toHaveBeenCalled()
    expect(mockShowSuccess).toHaveBeenCalledWith('Profile Updated Successfully')
  })
})
