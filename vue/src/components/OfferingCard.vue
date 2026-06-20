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
    <div class="offering-card__content">
      <p class="eyebrow">{{ offering.course_id }} &middot; {{ offering.semester }}</p>
      <h2>{{ offering.course_name_zh || 'Unnamed course' }}</h2>

      <dl class="offering-card__details">
        <div>
          <dt>Selection code</dt>
          <dd>{{ offering.scr_selcode }}</dd>
        </div>
        <div>
          <dt>Class ID</dt>
          <dd>{{ offering.cls_id }}</dd>
        </div>
        <div>
          <dt>Credits</dt>
          <dd>{{ offering.course_credits ?? 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Professor</dt>
          <dd>{{ offering.professor_name_zh || 'Not provided' }}</dd>
        </div>
      </dl>
    </div>

    <div class="offering-card__summary">
      <strong>{{ rating }}</strong>
      <span>{{ offering.review_count || 0 }} reviews</span>
      <RouterLink class="button" :to="`/offerings/${offeringId}`">View details</RouterLink>
    </div>
  </article>
</template>
