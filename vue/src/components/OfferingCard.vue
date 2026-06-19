<script setup>
import { computed } from 'vue'

const props = defineProps({
  offering: {
    type: Object,
    required: true,
  },
})

const offeringId = computed(() => props.offering.id ?? props.offering.offering_id)
const rating = computed(() => {
  const value = Number(props.offering.average_rating)
  return Number.isFinite(value) ? value.toFixed(1) : 'Not rated'
})
</script>

<template>
  <article class="card offering-card">
    <div>
      <p class="eyebrow">{{ offering.course_code }} · {{ offering.semester }}</p>
      <h2>{{ offering.course_name_en || offering.name_en }}</h2>
      <p v-if="offering.course_name_zh">{{ offering.course_name_zh }}</p>
      <p>
        Professor: {{ offering.professor_name_en || offering.professor?.name_en || 'Unknown' }}
      </p>
    </div>

    <div class="offering-card__summary">
      <strong>{{ rating }}</strong>
      <span>{{ offering.review_count || 0 }} reviews</span>
      <RouterLink class="button" :to="`/offerings/${offeringId}`">View details</RouterLink>
    </div>
  </article>
</template>
