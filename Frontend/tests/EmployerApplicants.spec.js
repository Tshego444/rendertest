// tests/EmployerApplicants.spec.js
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// --- Mock the JSON imports inline (do NOT reference external vars here) ---
vi.mock('@/data/joblistings.json', () => {
  return {
    default: [
      {
        jobID: 'job-1',
        title: 'Frontend Engineer',
        employerID: 'emp-1',
        applicants: [
          { userID: 'u1', time: '2025-09-01T10:00:00Z', status: 'Submitted' },
          { userID: 'u2', time: '2025-09-02T12:00:00Z', status: 'Review' }
        ]
      },
      {
        jobID: 'job-2',
        title: 'Backend Engineer',
        employerID: 'emp-2',
        applicants: []
      }
    ]
  }
})

vi.mock('@/data/usersDB.json', () => {
  return {
    default: [
      { userID: 'emp-1', name: 'Employer One', company: { name: 'Acme' } },
      { userID: 'u1', name: 'Alice Applicant', email: 'a@example.com', profile: { skills: ['Vue','JS'] } },
      { userID: 'u2', name: 'Bob Applicant', email: 'b@example.com', profile: { skills: ['Node','Express'] } }
    ]
  }
})

// --- Mock vue-router but keep internal mutable state and expose helpers ---
// Note: don't reference test-file variables inside this factory
vi.mock('vue-router', () => {
  const route = { params: { id: 'job-1' } } // mutable object inside mock
  const push = vi.fn()
  return {
    useRouter: () => ({ push }),
    useRoute: () => route,
    RouterLink: { template: '<a><slot /></a>' },
    // helpers tests can import to update state
    __setRouteParams: (p) => { route.params = p },
    __getPushMock: () => push
  }
})

// --- Mock composables (useError / useSuccess) ---
vi.mock('@/components/useError', () => {
  const showError = vi.fn()
  return { useError: () => ({ showError }), __getShowError: () => showError }
})
vi.mock('@/components/useSuccess', () => {
  const showSuccess = vi.fn()
  return { useSuccess: () => ({ showSuccess }), __getShowSuccess: () => showSuccess }
})

// --- Mock user store with internal mutable user and setter helper ---
vi.mock('@/store/user', () => {
  const user = { userID: 'emp-1', name: 'Employer One' }
  return {
    useUserStore: () => ({ user }),
    __setUser: (u) => { // merge fields into user
      Object.assign(user, u)
    },
    __getUserRef: () => user
  }
})

// Now import the component under test (mocks above will be applied)
import Applicants from '@/views/Employer/EmployerApplications.vue' // path as in your project

describe('Applicants view', () => {
  // import helpers from mocks where needed
  let routerMockModule
  let useErrorMockMod
  let useSuccessMockMod
  let userStoreMockMod

  beforeEach(async () => {
    // import the mocked modules so we can call their helper functions
    // vitest's module mocking keeps these imports synced with the mock factory above
    routerMockModule = await import('vue-router')
    useErrorMockMod = await import('@/components/useError')
    useSuccessMockMod = await import('@/components/useSuccess')
    userStoreMockMod = await import('@/store/user')

    // reset push and composable spies
    const push = routerMockModule.__getPushMock()
    push.mockClear()
    useErrorMockMod.__getShowError().mockClear()
    useSuccessMockMod.__getShowSuccess().mockClear()

    // set defaults
    routerMockModule.__setRouteParams({ id: 'job-1' })
    userStoreMockMod.__setUser({ userID: 'emp-1', name: 'Employer One' })
  })

  it('redirects when there is no job id in the URL', async () => {
    routerMockModule.__setRouteParams({}) // missing id
    const wrapper = mount(Applicants, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          ApplicantRow: { template: '<tr /><div/>' }
        }
      }
    })

    await nextTick()

    expect(useErrorMockMod.__getShowError()).toHaveBeenCalledWith('No job id in URL.')
    expect(routerMockModule.__getPushMock()).toHaveBeenCalledWith('/dashboard')
    await wrapper.unmount()
  })

  it('redirects when job is not found', async () => {
    routerMockModule.__setRouteParams({ id: 'missing-job' })
    const wrapper = mount(Applicants, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          ApplicantRow: { template: '<tr /><div/>' }
        }
      }
    })

    await nextTick()

    expect(useErrorMockMod.__getShowError()).toHaveBeenCalledWith('Job not found in job listings.')
    expect(routerMockModule.__getPushMock()).toHaveBeenCalledWith('/dashboard')
    await wrapper.unmount()
  })

  it('redirects when current user is not the employer (unauthorized)', async () => {
    // set route to job-1 but user is different
    routerMockModule.__setRouteParams({ id: 'job-1' })
    userStoreMockMod.__setUser({ userID: 'someone-else', name: 'Intruder' })

    const wrapper = mount(Applicants, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          ApplicantRow: { template: '<tr /><div/>' }
        }
      }
    })

    await nextTick()

    expect(useErrorMockMod.__getShowError()).toHaveBeenCalledWith('Unauthorized Access')
    expect(routerMockModule.__getPushMock()).toHaveBeenCalledWith('/dashboard')
    await wrapper.unmount()
  })

  it('loads applicants and renders ApplicantRow components when authorized', async () => {
    // ensure authorized user & route
    routerMockModule.__setRouteParams({ id: 'job-1' })
    userStoreMockMod.__setUser({ userID: 'emp-1', name: 'Employer One' })

    const ApplicantRowStub = {
      props: ['applicant'],
      template: `<tr class="app-row"><td class="name">{{ applicant.name }}</td></tr>`
    }

    const wrapper = mount(Applicants, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          ApplicantRow: ApplicantRowStub
        }
      }
    })

    // wait for mounted hook and reactive updates
    await nextTick()
    await nextTick()

    const rows = wrapper.findAll('tr.app-row')
    expect(rows.length).toBe(2)

    const names = wrapper.findAll('.name').map(n => n.text())
    expect(names).toContain('Alice Applicant')
    expect(names).toContain('Bob Applicant')

    expect(wrapper.text()).not.toContain('Loading applicants...')
    await wrapper.unmount()
  })
})
