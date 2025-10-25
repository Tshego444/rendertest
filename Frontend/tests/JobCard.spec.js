import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import JobCard from '@/components/JobCard.vue'
import jobListings from '@/data/jobListings.json'

// Single mock store instance used by JobCard tests
const mockUserStore = {
  user: { applicationsViewed: [] },
  viewApplication: vi.fn((id) => {
    mockUserStore.user.applicationsViewed.push(id)
  })
}

// mock user state
vi.mock('@/store/user', () => ({
  useUserStore: () => mockUserStore
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('JobCard.vue', () => {
  let wrapper

  beforeEach(() => {
    // reset viewed list
    mockUserStore.user.applicationsViewed = []
    mockUserStore.viewApplication.mockClear()

    wrapper = mount(JobCard, {
      global: {
        stubs: {
          FontAwesomeIcon: { template: '<span />' }
        }
      }
    })
  })

  it('shows the first job when none have been viewed', () => {
    const expected = jobListings.find(l => true)
    expect(wrapper.text()).toContain(expected.title)
  })

  it('skip button calls viewApplication and advances to next job', async () => {
    const firstJob = jobListings[0]
    const secondJob = jobListings.find((l) => l.jobID !== firstJob.jobID)

    // click the Skip button
    const skipBtn = wrapper.find('button[title="Skip"]')
    await skipBtn.trigger('click')

    expect(mockUserStore.viewApplication).toHaveBeenCalledWith(firstJob.jobID)
    // after skipping, next job should be displayed
    expect(wrapper.text()).toContain(secondJob.title)
  })

  it('accept button calls viewApplication and advances to next job', async () => {
    mockUserStore.user.applicationsViewed = []
    mockUserStore.viewApplication.mockClear()
    wrapper = mount(JobCard, {
      global: {
        stubs: { FontAwesomeIcon: { template: '<span />' } }
      }
    })

    const firstJob = jobListings[0]
    const acceptBtn = wrapper.find('button[title="Apply / Accept"]')
    await acceptBtn.trigger('click')

    expect(mockUserStore.viewApplication).toHaveBeenCalledWith(firstJob.jobID)
    expect(wrapper.text()).not.toContain(firstJob.title)
  })
})
