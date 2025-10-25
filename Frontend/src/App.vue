<script setup>
import { RouterView } from 'vue-router'
import { useError } from '@/components/useError'
import { useSuccess } from './components/useSuccess'
import ErrorBox from '@/components/ErrorBox.vue'
import SuccessBox from './components/SuccessBox.vue'
import ChatbotFloating from '@/components/ChatbotFloating.vue'

const { errorMessage, clearError } = useError()
const { successMessage, clearSuccess } = useSuccess()
</script>

<template>
  <RouterView />
  <ChatbotFloating />
  <ErrorBox :message="errorMessage" @close="clearError" />
  <SuccessBox :message="successMessage" @close="clearSuccess" />
</template>
