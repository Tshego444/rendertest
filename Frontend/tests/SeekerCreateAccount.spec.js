import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SeekerSignUp from '@/views/JobSeeker/SeekerSignUp.vue'

// Mock useError
const mockShowError = vi.fn()
vi.mock('@/components/useError', () => ({
  useError: () => ({ showError: mockShowError }),
}))

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot/></a>' },
}))

function setInputFiles(fileInputWrapper, filesArray) {
  const el = fileInputWrapper.element
  const fileList = Array.from(filesArray)
  fileList.item = (i) => fileList[i]
  Object.defineProperty(el, 'files', {
    value: fileList,
    writable: false,
    configurable: true,
  })
}

describe('SeekerSignUp.vue', () => {
  let wrapper

  function mountComponent() {
    return mount(SeekerSignUp, {
      global: {
        stubs: {
          FontAwesomeIcon: { template: '<span />' },
        },
      },
    })
  }

  beforeEach(() => {
    wrapper = mountComponent()
    mockShowError.mockClear()
    mockPush.mockClear()
  })

  it('renders the form fields', () => {
    expect(wrapper.find('#fname').exists()).toBe(true)
    expect(wrapper.find('#sname').exists()).toBe(true)
    expect(wrapper.find('#location').exists()).toBe(true)
    expect(wrapper.find('#experience').exists()).toBe(true)
    expect(wrapper.find('#skillInput').exists()).toBe(true)
    expect(wrapper.find('#cvInput').exists()).toBe(true)
  })

  it('adds and removes skills', async () => {
    const skillInput = wrapper.find('#skillInput')
    await skillInput.setValue('Vue.js')
    await wrapper.find('.add-skill-btn').trigger('click')

    expect(wrapper.text()).toContain('Vue.js')

    await wrapper.find('.skill-remove').trigger('click')
    expect(wrapper.text()).not.toContain('Vue.js')
  })

  it('rejects non-PDF file upload', async () => {
    const fileInputWrapper = wrapper.find('#cvInput')

    // Create a non-pdf file
    const file = new File(['content'], 'resume.txt', { type: 'text/plain' })

    // Use helper to set the element.files
    setInputFiles(fileInputWrapper, [file])

    // Trigger change
    await fileInputWrapper.trigger('change')

    expect(mockShowError).toHaveBeenCalledWith(
      'Unsupported file type. Please upload PDF only'
    )
  })

  it('rejects file over 5MB', async () => {
    const fileInputWrapper = wrapper.find('#cvInput')

    // create a big pdf (~6 MB)
    const bigBlob = new Uint8Array(6 * 1024 * 1024)
    const bigFile = new File([bigBlob], 'big.pdf', { type: 'application/pdf' })

    setInputFiles(fileInputWrapper, [bigFile])
    await fileInputWrapper.trigger('change')

    expect(mockShowError).toHaveBeenCalledWith(
      'File is too large. Maximum allowed size is 5 MB.'
    )
  })

  it('submits successfully with valid data', async () => {
    await wrapper.find('#fname').setValue('John')
    await wrapper.find('#sname').setValue('Doe')
    await wrapper.find('#location').setValue('Cape Town')
    await wrapper.find('#experience').setValue('5') // browsers give string values

    const skillInput = wrapper.find('#skillInput')
    await skillInput.setValue('Vue.js')
    await wrapper.find('.add-skill-btn').trigger('click')
    await skillInput.setValue('JavaScript')
    await wrapper.find('.add-skill-btn').trigger('click')
    await skillInput.setValue('CSS')
    await wrapper.find('.add-skill-btn').trigger('click')

    // upload a valid pdf by setting element.files via helper
    const pdf = new File([new Uint8Array(1024)], 'resume.pdf', { type: 'application/pdf' })
    const fileInputWrapper = wrapper.find('#cvInput')
    setInputFiles(fileInputWrapper, [pdf])
    await fileInputWrapper.trigger('change')

    // click submit
    await wrapper.find('.btn').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/feed')
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('processes dropped PDF file via onDrop', async () => {
    const dropZone = wrapper.find('.upload-zone')
    const pdf = new File([new Uint8Array(1024)], 'dropped.pdf', { type: 'application/pdf' })

    // Simulate drop event: provide a lightweight dataTransfer object
    const fakeDataTransfer = { files: [pdf] }

    await dropZone.trigger('drop', {
      dataTransfer: fakeDataTransfer,
      preventDefault: () => {},
    })

    // file name should appear
    const fileNameEl = wrapper.find('.file-name')
    expect(fileNameEl.exists()).toBe(true)
    expect(fileNameEl.text()).toContain('dropped.pdf')
  })
})
