// tests/ContinueSignup.spec.js
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// --- Safe mocks (factories must not reference test-local variables) ---

// mock useError composable
vi.mock('@/components/useError', () => {
  const showError = vi.fn()
  return {
    useError: () => ({ showError }),
    __getShowError: () => showError
  }
})

// mock vue-router useRouter and RouterLink (expose helper to get push spy)
vi.mock('vue-router', () => {
  const push = vi.fn()
  return {
    useRouter: () => ({ push }),
    RouterLink: { template: '<a><slot /></a>' },
    __getPushMock: () => push
  }
})

// mock fontawesome component so mounting doesn't require library setup
vi.mock('@fortawesome/vue-fontawesome', () => {
  return {
    FontAwesomeIcon: { template: '<span />' }
  }
})

// Import component after mocks are registered
// <- UPDATE THIS PATH to where your component actually lives if different
import ContinueSignup from '@/views/Employer/EmployerCreateAccount.vue'

describe('ContinueSignup component validations', () => {
  let useErrorMod
  let routerMod

  beforeEach(async () => {
    // import mocks to access helper spies
    useErrorMod = await import('@/components/useError')
    routerMod = await import('vue-router')

    // clear spies between tests
    useErrorMod.__getShowError().mockClear()
    routerMod.__getPushMock().mockClear()
  })

  it('renders with empty initial inputs', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    expect(wrapper.find('#name').element.value).toBe('')
    expect(wrapper.find('#email').element.value).toBe('')
    expect(wrapper.find('#password').element.value).toBe('')
    expect(wrapper.find('#companyLocation').element.value).toBe('')
    expect(wrapper.find('#companyIndustry').element.value).toBe('')

    await wrapper.unmount()
  })

  it('errors when company name is less than 3 chars', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    await wrapper.find('#name').setValue('Ab') // too short
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith(
      'Please enter a company name (at least 3 characters)'
    )
    expect(routerMod.__getPushMock()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors on invalid email', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    // set valid name then invalid email to exercise email branch
    await wrapper.find('#name').setValue('Good Company')
    await wrapper.find('#email').setValue('not-an-email')
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Please enter a valid email')
    expect(routerMod.__getPushMock()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when password is less than 6 chars', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    // set previous fields valid so password is the failing check
    await wrapper.find('#name').setValue('Good Company')
    await wrapper.find('#email').setValue('a@example.com')
    await wrapper.find('#password').setValue('123') // too short
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Password must be at least 6 characters')
    expect(routerMod.__getPushMock()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when company location is less than 3 chars', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    // set previous fields valid so companyLocation is the failing check
    await wrapper.find('#name').setValue('Good Company')
    await wrapper.find('#email').setValue('a@example.com')
    await wrapper.find('#password').setValue('123456')
    await wrapper.find('#companyLocation').setValue('A') // too short
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Please enter the company location')
    expect(routerMod.__getPushMock()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('errors when company industry is less than 2 chars', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    // set previous fields valid so companyIndustry is the failing check
    await wrapper.find('#name').setValue('Good Company')
    await wrapper.find('#email').setValue('a@example.com')
    await wrapper.find('#password').setValue('123456')
    await wrapper.find('#companyLocation').setValue('Cape Town')
    await wrapper.find('#companyIndustry').setValue('A') // too short
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).toHaveBeenCalledWith('Please enter the company industry')
    expect(routerMod.__getPushMock()).not.toHaveBeenCalled()

    await wrapper.unmount()
  })

  it('navigates to /feed on valid submission', async () => {
    const wrapper = mount(ContinueSignup, { global: { stubs: { RouterLink: true } } })
    await nextTick()

    await wrapper.find('#name').setValue('Good Company')
    await wrapper.find('#email').setValue('a@example.com')
    await wrapper.find('#password').setValue('strongpass')
    await wrapper.find('#companyLocation').setValue('Sandton, Gauteng')
    await wrapper.find('#companyIndustry').setValue('Technology')

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(useErrorMod.__getShowError()).not.toHaveBeenCalled()
    expect(routerMod.__getPushMock()).toHaveBeenCalledWith('/feed')

    await wrapper.unmount()
  })
})
