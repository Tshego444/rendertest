import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import Create from '@/views/Employer/Create.vue' // adjust if your file lives elsewhere

// --- router mocks ---
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // default route is the create path; tests can override by re-mocking if needed
  useRoute: () => ({ path: '/employer/create', params: {} }),
  RouterLink: { template: '<a><slot /></a>' }
}))

// --- user store mock ---
const mockUserStore = {
  user: {
    userID: 'employer-1',
    name: 'Employer Inc',
    company: { name: 'Employer Inc', location: 'Sandton', industry: 'Tech' }
  }
}
vi.mock('@/store/user', () => ({
  useUserStore: () => mockUserStore
}))

// --- job store mock (addJob / updateJob) ---
const addJobMock = vi.fn()
const updateJobMock = vi.fn()
const mockJobStore = {
  jobs: [],
  addJob: addJobMock,
  updateJob: updateJobMock
}
vi.mock('@/store/jobStore', () => ({
  useJobStore: () => mockJobStore
}))

// --- success / error composables ---
const showErrorMock = vi.fn()
const showSuccessMock = vi.fn()
vi.mock('@/components/useError', () => ({
  useError: () => ({ showError: showErrorMock })
}))
vi.mock('@/components/useSuccess', () => ({
  useSuccess: () => ({ showSuccess: showSuccessMock })
}))

// --- validation helpers ---
// Provide deterministic behavior: isRequired => truthy, minLength checks length
vi.mock('@/Utils/Validation', () => ({
  isRequired: (v) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    return Boolean(v)
  },
  minLength: (v, n) => {
    if (typeof v === 'string') return v.trim().length >= n
    if (Array.isArray(v)) return v.length >= n
    return false
  }
}))

describe('Create view', () => {
  beforeEach(() => {
    // clear mocks and reset store arrays before each test
    mockPush.mockClear()
    addJobMock.mockClear()
    updateJobMock.mockClear()
    showErrorMock.mockClear()
    showSuccessMock.mockClear()
    mockJobStore.jobs.length = 0
  })

  it('creates a job successfully when form is filled correctly', async () => {
    const wrapper = mount(Create, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' }
        }
      }
    })

    // Fill text fields
    await wrapper.find('#name').setValue('Senior Frontend Engineer')
    await wrapper.find('#description').setValue('Build beautiful UIs with Vue and Tailwind. Needs experience.')
    await wrapper.find('#location').setValue('Sandton, Gauteng')

    // Salary min/max
    await wrapper.find('#salaryMin').setValue('18000')
    await wrapper.find('#salaryMax').setValue('22000')

    // Ensure selects are set (jobType defaults set in component but we set explicitly as a sanity check)
    await wrapper.find('#workplace').setValue('Remote')
    await wrapper.find('#time').setValue('Full-time')
    await wrapper.find('#role').setValue('Senior')

    // Add 3 tasks using the newTask input + Add button
    const newTaskInput = wrapper.find('input[placeholder="Add a task"], input.form-input.flex-1')
    const addBtn = wrapper.find('button.btn')

    // In templates the Add button is the first .btn after tasks input; ensure we pick correct add button:
    // there are multiple buttons (Add and the final submit), but the Add button has text 'Add' so find by that
    const addButtons = wrapper.findAll('button')
    const taskAddBtn = addButtons.find(b => b.text().trim() === 'Add')
    expect(taskAddBtn).toBeTruthy()

    await newTaskInput.setValue('Implement UI components')
    await taskAddBtn.trigger('click')
    await nextTick()

    await newTaskInput.setValue('Write unit tests')
    await taskAddBtn.trigger('click')
    await nextTick()

    await newTaskInput.setValue('Optimize performance')
    await taskAddBtn.trigger('click')
    await nextTick()

    // Confirm tasks are rendered
    const taskItems = wrapper.findAll('ul.space-y-2 li')
    expect(taskItems.length).toBeGreaterThanOrEqual(3)

    // Submit
    // The submit button shows 'Add' in create route; find it specifically (last .btn likely)
    const submitBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Add' && b.attributes('type') !== 'button' ? false : true)
    // Safer: find last button and assume it's the submit
    const allButtons = wrapper.findAll('button')
    const submitCandidate = allButtons[allButtons.length - 1]
    await submitCandidate.trigger('click')

    // Assert addJob called once and router navigated to dashboard
    expect(addJobMock).toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalledWith('Job listing created successfully')
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows error and does NOT create when less than 3 tasks added', async () => {
    const wrapper = mount(Create, {
      global: {
        stubs: {
          Navbar: { template: '<div />' },
          FontAwesomeIcon: { template: '<span />' }
        }
      }
    })

    // Fill required fields but only add 2 tasks
    await wrapper.find('#name').setValue('Junior Dev')
    await wrapper.find('#description').setValue('Short but sufficient description here.')
    await wrapper.find('#location').setValue('Cape Town')
    await wrapper.find('#salaryMin').setValue('8000')
    await wrapper.find('#salaryMax').setValue('10000')

    // Add two tasks
    const newTaskInput = wrapper.find('input[placeholder="Add a task"], input.form-input.flex-1')
    const taskAddBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Add')

    await newTaskInput.setValue('Do thing A')
    await taskAddBtn.trigger('click')
    await nextTick()
    await newTaskInput.setValue('Do thing B')
    await taskAddBtn.trigger('click')
    await nextTick()

    // Submit
    const allButtons = wrapper.findAll('button')
    const submitBtn = allButtons[allButtons.length - 1]
    await submitBtn.trigger('click')

    expect(showErrorMock).toHaveBeenCalledWith('Please add at least 3 tasks')
    expect(addJobMock).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error when description is too short and does not add job', async () => {
  const wrapper = mount(Create, {
    global: {
      stubs: {
        Navbar: { template: '<div />' },
        FontAwesomeIcon: { template: '<span />' }
      }
    }
  })

  // Make the role name valid (>= 3 chars) so description validation runs
  await wrapper.find('#name').setValue('QA Engineer')
  // Description too short (<10) to trigger description validation
  await wrapper.find('#description').setValue('short')
  await wrapper.find('#location').setValue('JHB')
  await wrapper.find('#salaryMin').setValue('5000')
  await wrapper.find('#salaryMax').setValue('6000')

  // Add the required 3 tasks so the description validation fails first
  const newTaskInput = wrapper.find('input[placeholder="Add a task"], input.form-input.flex-1')
  const taskAddBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Add')
  await newTaskInput.setValue('task 1')
  await taskAddBtn.trigger('click')
  await nextTick()
  await newTaskInput.setValue('task 2')
  await taskAddBtn.trigger('click')
  await nextTick()
  await newTaskInput.setValue('task 3')
  await taskAddBtn.trigger('click')
  await nextTick()

  // Submit
  const allButtons = wrapper.findAll('button')
  const submitBtn = allButtons[allButtons.length - 1]
  await submitBtn.trigger('click')

  expect(showErrorMock).toHaveBeenCalledWith('Please enter a description of at least 10 characters')
  expect(addJobMock).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  })

})
