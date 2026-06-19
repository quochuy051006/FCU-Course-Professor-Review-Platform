<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: 'Search by course, professor, or semester',
  },
})

const emit = defineEmits(['update:modelValue', 'search'])
const router = useRouter()

function submitSearch() {
  const query = props.modelValue.trim()
  emit('search', query)
  router.push({ name: 'search', query: query ? { q: query } : {} })
}
</script>

<template>
  <form class="search-bar" role="search" @submit.prevent="submitSearch">
    <label class="sr-only" for="offering-search">Search offerings</label>
    <input
      id="offering-search"
      :value="modelValue"
      :placeholder="placeholder"
      type="search"
      @input="$emit('update:modelValue', $event.target.value)"
    >
    <button class="button" type="submit">Search</button>
  </form>
</template>
