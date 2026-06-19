<script setup>
import { computed } from 'vue'

const props = defineProps({
  review: {
    type: Object,
    required: true,
  },
  interactive: {
    type: Boolean,
    default: true,
  },
})

defineEmits(['vote', 'report'])

const ratingFields = [
  'rating_teaching_quality',
  'rating_grading_fairness',
  'rating_workload',
  'rating_exam_difficulty',
  'rating_interaction',
  'rating_practical_value',
]

const overallRating = computed(() => {
  if (props.review.overall_rating != null) {
    return Number(props.review.overall_rating).toFixed(1)
  }

  const ratings = ratingFields
    .map((field) => Number(props.review[field]))
    .filter(Number.isFinite)

  if (!ratings.length) return 'Not rated'

  return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)
})
</script>

<template>
  <article class="card review-card">
    <header class="review-card__header">
      <div>
        <strong>{{ review.author_name || 'FCU student' }}</strong>
        <p>{{ review.created_at ? new Date(review.created_at).toLocaleDateString() : '' }}</p>
      </div>
      <span class="rating-badge">{{ overallRating }} / 5</span>
    </header>

    <p>{{ review.comment }}</p>
    <p v-if="review.advice"><strong>Advice:</strong> {{ review.advice }}</p>

    <ul v-if="review.tags?.length" class="tag-list" aria-label="Review tags">
      <li v-for="tag in review.tags" :key="tag.id">{{ tag.name_en || tag.name_zh }}</li>
    </ul>

    <footer v-if="interactive" class="review-card__actions">
      <button type="button" @click="$emit('vote', { reviewId: review.id, value: 1 })">
        Helpful {{ review.upvote_count || 0 }}
      </button>
      <button type="button" @click="$emit('vote', { reviewId: review.id, value: -1 })">
        Not helpful {{ review.downvote_count || 0 }}
      </button>
      <button type="button" @click="$emit('report', review.id)">Report</button>
    </footer>
  </article>
</template>
