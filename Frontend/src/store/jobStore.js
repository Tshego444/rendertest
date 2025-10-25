import { defineStore } from 'pinia'
import jobListings from '@/data/jobListings.json'

export const useJobStore = defineStore('jobStore', {
  state: () => ({
    jobs: [...jobListings] // reactive array of jobs loaded from JSON
  }),
  actions: {
    // Add a new job to the list
    addJob(job) {
      this.jobs.push(job)
    },
    // Update an existing job by ID
    updateJob(jobID, updatedJob) {
      const idx = this.jobs.findIndex(j => j.jobID === jobID)
      if (idx !== -1) this.jobs[idx] = { ...this.jobs[idx], ...updatedJob }
    },
    // Remove a job by ID
    removeJob(jobID) {
      this.jobs = this.jobs.filter(job => job.jobID !== jobID)
    }
  }
})
