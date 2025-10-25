import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Feed from '@/views/JobSeeker/Feed.vue'

describe('Feed page', () => {
  it('renders Navbar and JobCard components', () => {
    const wrapper = mount(Feed, {
      global: {
        stubs: {
          Navbar: { template: '<div class="stub-navbar">Navbar</div>' },
          JobCard: { template: '<div class="stub-jobcard">JobCard</div>' }
        }
      }
    })

    expect(wrapper.find('.stub-navbar').exists()).toBe(true)
    expect(wrapper.find('.stub-jobcard').exists()).toBe(true)
  })
})
