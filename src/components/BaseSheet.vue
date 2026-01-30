<script setup>
import { onMounted, onUnmounted } from 'vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const onKeydown = (e) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="sheet">
    <div v-if="show" class="sheet-overlay" @click.self="$emit('close')">
      <div class="sheet">
        <div class="sheet-handle" @click="$emit('close')"><span></span></div>
        <h2 class="section-title">{{ title }}</h2>
        <div class="sheet-scroll">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>
