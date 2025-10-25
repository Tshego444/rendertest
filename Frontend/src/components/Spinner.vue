<script setup>
defineProps({
  size: {
    type: [String, Number],
    default: 25, // pixels
  },
  color: {
    type: String,
    default: '#fff', // Tailwind blue-500
  },
  thickness: {
    type: [String, Number],
    default: 4,
  },
})
</script>

<template>
  <div class="spinner-wrapper">
    <svg
      class="spinner"
      :width="size"
      :height="size"
      viewBox="0 0 50 50"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle
        class="spinner-ring"
        cx="25"
        cy="25"
        r="20"
        :stroke="color"
        :stroke-width="thickness"
        stroke-linecap="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.spinner-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  animation: spin 0.9s linear infinite;
}

.spinner-ring {
  stroke-dasharray: 125;
  stroke-dashoffset: 75;
  animation: dash 1.5s ease-in-out infinite;
  transform-origin: center;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dashoffset: 125;
  }
  50% {
    stroke-dashoffset: 25;
    transform: rotate(45deg);
  }
  100% {
    stroke-dashoffset: 125;
    transform: rotate(360deg);
  }
}
</style>
