import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dashboard from '@/views/Employer/Dashboard.vue' // adjust path if needed
// If your Dashboard file is a .vue in a different location, update the import

// --- Mocks ---
// mock router push & RouterLink
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>' }
}))

// mock Navbar and FontAwesomeIcon globally via stubs in mount options (below)

// mock user store and job store
const mockUserStore = {
  user: { userID: 'employer-1', name: 'Emp' }
}

const jobsForEmployer = [
  {
    jobID: 'j1',
    title: 'Frontend Developer',
    description: 'Build UI',
    location: 'Sandton',
    jobType: { time: 'Full-time', workplace: 'Remote' },
    employerID: 'employer-1'
  },
  {
    jobID: 'j2',
    title: 'Backend Developer',
    description: 'APIs',
    location: 'Cape Town',
    jobType: { time: 'Part-time', workplace: 'Onsite' },
    employerID: 'employer-1'
  },
  // a job that belongs to someone else (should be filtered out)
  {
    jobID: 'j3',
    title: 'Wrong Employer Job',
    description: 'Not ours',
    location: 'JHB',
    jobType: { time: 'Contract', workplace: 'Hybrid' },
    employerID: 'other-employer'
  }
]

vi.mock('@/store/user', () => ({
  useUserStore: () => mockUserStore
}))

// jobStore will be re-assigned per test by re-mocking useJobStore
let currentJobs = []

vi.mock('@/store/jobStore', () => ({
  useJobStore: () => ({ jobs: currentJobs, removeJob: vi.fn() })
}))

// --- Tests ---
describe('Dashboard view', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it("shows empty state when there are no job listings for the user", async () => {
    // set currentJobs to empty
    currentJobs.length = 0

    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          // Provide a simple JobListing stub; this won't be used in empty state
          JobListing: { props: ['title'], template: '<div class="job-listing">{{ title }}</div>' }
        }
      }
    })

    // The empty message should be visible
    expect(wrapper.text()).toContain("You don't have any job listings yet.")
  })

  it('renders a JobListing for each job that belongs to the current user', async () => {
    // set currentJobs to our jobs list that includes 2 matching and 1 non-matching
    currentJobs.length = 0
    currentJobs.push(...jobsForEmployer)

    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          // The JobListing stub shows the title, so we can assert on number of rendered stub instances
          JobListing: {
            props: ['jobID', 'title'],
            template: '<div class="job-listing" :data-id="jobID">{{ title }}</div>'
          }
        }
      }
    })

    // only the two jobs that match employerID === mockUserStore.user.userID should be rendered
    const listings = wrapper.findAll('.job-listing')
    expect(listings.length).toBe(2)

    // verify titles correspond to the two matching jobs
    const titles = listings.map(n => n.text())
    expect(titles).toContain('Frontend Developer')
    expect(titles).toContain('Backend Developer')

    // ensure the job that belongs to 'other-employer' is not rendered
    expect(titles).not.toContain('Wrong Employer Job')
  })

  it('navigates to create page when Create New Listing clicked', async () => {
    // set at least one job so the page layout is the same
    currentJobs.length = 0
    currentJobs.push(...jobsForEmployer)

    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' },
          JobListing: {
            props: ['jobID', 'title'],
            template: '<div class="job-listing">{{ title }}</div>'
          }
        }
      }
    })

    const createBtn = wrapper.find('button')
    expect(createBtn.exists()).toBe(true)

    await createBtn.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/employer/create')
  })
})
