import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// load the job listings so the test uses the same data as the component
import jobListings from '@/data/jobListings.json'

// Pick a random userID that exists in the jobListings applicants
const sampleUserId = (() => {
  for (const job of jobListings) {
    if (Array.isArray(job.applicants) && job.applicants.length > 0) {
      return job.applicants[0].userID
    }
  }
  return 'test-user'
})()

// Mock the user store BEFORE importing the component so module-level reads get the mock
vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    user: {
      userID: sampleUserId,
      name: 'Test User'
    }
  })
}))

import Applications from '@/views/JobSeeker/Applications.vue'

// Utility that mirrors the component's myApplications building logic
function buildMyApplicationsForUser(userId) {
  const formatDate = (isoString) => {
    if (!isoString) return ''
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(isoString))
  }

  return jobListings
    .map((job) => {
      const applicant = job.applicants?.find((a) => a.userID === userId)
      if (applicant) {
        return {
          ...job,
          status: applicant.status,
          appliedAt: formatDate(applicant.time)
        }
      }
      return null
    })
    .filter(Boolean)
}

describe('Applications page', () => {
  let wrapper
  let expectedApplications

  beforeEach(() => {
    expectedApplications = buildMyApplicationsForUser(sampleUserId)

    wrapper = mount(Applications, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          Navbar: { template: '<div class="stub-navbar">Navbar</div>' },
          ApplicationCard: {
            props: ['title', 'company', 'typeOfJob', 'status', 'date'],
            template:
              '<div class="app-card" data-status="{{ status }}">\
                <span class="title">{{ title }}</span>\
                <span class="company">{{ company }}</span>\
                <span class="status">{{ status }}</span>\
                <span class="date">{{ date }}</span>\
              </div>'
          }
        }
      }
    })
  })

  it('renders header and filter buttons', () => {
    expect(wrapper.find('h2').text()).toContain('My Applications')
    const buttons = wrapper.findAll('button.btn')
    expect(buttons.length).toBeGreaterThanOrEqual(5)
  })

  it('shows all applications initially', () => {
    const rendered = wrapper.findAll('.app-card')
    expect(rendered.length).toBe(expectedApplications.length)
    if (expectedApplications.length > 0) {
      expect(wrapper.text()).toContain(expectedApplications[0].title)
    }
  })

  it('filters to "Submitted" when Submitted button clicked', async () => {
    const submittedBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Submitted')
    expect(submittedBtn).toBeTruthy()
    await submittedBtn.trigger('click')

    const filtered = expectedApplications.filter((a) => a.status === 'Submitted')
    const rendered = wrapper.findAll('.app-card')
    expect(rendered.length).toBe(filtered.length)
  })

  it('filters to "In Review" when In Review button clicked', async () => {
    const inReviewBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'In Review')
    expect(inReviewBtn).toBeTruthy()
    await inReviewBtn.trigger('click')

    const filtered = expectedApplications.filter((a) => a.status === 'Review')
    const rendered = wrapper.findAll('.app-card')
    expect(rendered.length).toBe(filtered.length)
  })

  it('filters to "Interview" when Interview button clicked', async () => {
    const btn = wrapper.findAll('button').find((b) => b.text().trim() === 'Interview')
    expect(btn).toBeTruthy()
    await btn.trigger('click')

    const filtered = expectedApplications.filter((a) => a.status === 'Interview')
    const rendered = wrapper.findAll('.app-card')
    expect(rendered.length).toBe(filtered.length)
  })

  it('filters to "Declined" when Declined button clicked', async () => {
    const btn = wrapper.findAll('button').find((b) => b.text().trim() === 'Declined')
    expect(btn).toBeTruthy()
    await btn.trigger('click')

    const filtered = expectedApplications.filter((a) => a.status === 'Declined')
    const rendered = wrapper.findAll('.app-card')
    expect(rendered.length).toBe(filtered.length)
  })

  it('returns to All when All button clicked', async () => {
    const someBtn = wrapper.findAll('button').find((b) => b.text().trim() !== 'All')
    if (someBtn) await someBtn.trigger('click')

    const allBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'All')
    expect(allBtn).toBeTruthy()
    await allBtn.trigger('click')

    const rendered = wrapper.findAll('.app-card')
    expect(rendered.length).toBe(expectedApplications.length)
  })
})
