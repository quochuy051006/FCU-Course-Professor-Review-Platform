<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['change'])
const jumpPage = ref(String(props.currentPage))

const visiblePages = computed(() => {
  const maximumVisible = 6

  if (props.totalPages <= maximumVisible) {
    return Array.from({ length: props.totalPages }, (_, index) => index + 1)
  }

  let start = props.currentPage - Math.floor(maximumVisible / 2)
  start = Math.max(1, Math.min(start, props.totalPages - maximumVisible + 1))

  return Array.from({ length: maximumVisible }, (_, index) => start + index)
})

function selectPage(page) {
  const target = Math.min(Math.max(page, 1), props.totalPages)
  emit('change', target)
}

function submitJump() {
  const page = Number.parseInt(jumpPage.value, 10)

  if (!Number.isInteger(page)) {
    jumpPage.value = String(props.currentPage)
    return
  }

  selectPage(page)
}

watch(
  () => props.currentPage,
  (page) => {
    jumpPage.value = String(page)
  },
)
</script>

<template>
  <nav class="pagination" aria-label="Pagination">
    <div class="pagination__buttons">
      <button
        class="button button--secondary"
        :disabled="currentPage === 1"
        type="button"
        @click="selectPage(currentPage - 1)"
      >
        Previous
      </button>

      <button
        v-for="page in visiblePages"
        :key="page"
        class="button pagination__page"
        :class="{ 'pagination__page--active': page === currentPage }"
        :aria-current="page === currentPage ? 'page' : undefined"
        type="button"
        @click="selectPage(page)"
      >
        {{ page }}
      </button>

      <button
        class="button button--secondary"
        :disabled="currentPage === totalPages"
        type="button"
        @click="selectPage(currentPage + 1)"
      >
        Next
      </button>
    </div>

    <form class="pagination__jump" @submit.prevent="submitJump">
      <label for="page-jump">Go to page</label>
      <input
        id="page-jump"
        v-model="jumpPage"
        :max="totalPages"
        min="1"
        type="number"
      >
      <button class="button button--secondary" type="submit">Go</button>
      <span class="muted">of {{ totalPages }}</span>
    </form>
  </nav>
</template>
