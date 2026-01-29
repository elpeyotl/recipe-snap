<script setup>
import { onMounted, onUnmounted } from 'vue'

defineProps({
  maxWidth: {
    type: String,
    default: '400px'
  }
})

const emit = defineEmits(['close'])

const onKeydown = (e) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container" :style="{ maxWidth }">
      <button class="modal-close" @click="$emit('close')">×</button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: var(--card-bg);
  border-radius: 1rem;
  width: 100%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-light);
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
  z-index: 1;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
