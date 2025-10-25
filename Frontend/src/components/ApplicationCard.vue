<script setup>
import { defineProps } from 'vue'

defineProps({
  title: {
    type: String,
  },
  company: {
    type: String,
  },
  typeOfJob: {
    type: String,
  },
  status: {
    type: String,
    default: 'Submitted',
  },
  date: {
    type: String,
  },
})
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-lg md:flex-row md:items-center"
  >
    <div class="flex-grow">
      <p class="text-xl font-semibold">{{ title }}</p>
      <p class="text-sm text-[#64748B]">{{ company }} · {{ typeOfJob }}</p>
    </div>

    <div class="flex items-center gap-4">
      <!-- Status pill -->
      <div
        class="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-3"
        :class="{
          'bg-gray-100 text-grey-700': status === 'Submitted',
          'bg-yellow-100 text-yellow-700': status === 'Review',
          'bg-blue-100 text-blue-700': status === 'Interview',
          'bg-red-100 text-red-700': status === 'Rejected',
          'bg-green-100 text-green-700': status === 'Hired',
          'bg-gray-100 text-gray-700': status === 'All',
        }"
      >
        <p class="text-sm font-medium">{{ status }}</p>
      </div>

      <p class="text-sm text-[#64748B]">{{ date }}</p>
    </div>
  </div>
</template>
