<script setup>
import { computed } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
  tags: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: Array,
    default: () => [],
  },
  max: {
    type: Number,
    default: 5,
  },
})

const emit = defineEmits(['update:modelValue'])

const groupedCategories = computed(() => {
  if (props.categories.length) return props.categories
  if (props.tags.length) return [{ key: 'tags', label: 'Tags', tags: props.tags }]
  return []
})

function toggleTag(tagId) {
  const selected = props.modelValue.includes(tagId)
    ? props.modelValue.filter((id) => id !== tagId)
    : [...props.modelValue, tagId]

  if (selected.length <= props.max) {
    emit('update:modelValue', selected)
  }
}
</script>

<template>
  <fieldset class="tag-selector">
    <legend>Tags</legend>
    <div class="tag-selector__summary">
      <span>Choose up to {{ max }} tags.</span>
      <strong>{{ modelValue.length }} / {{ max }} selected</strong>
    </div>

    <div v-if="groupedCategories.length" class="tag-category-list">
      <section
        v-for="category in groupedCategories"
        :key="category.key"
        class="tag-category"
        :aria-labelledby="`tag-category-${category.key}`"
      >
        <h3 :id="`tag-category-${category.key}`">{{ category.label }}</h3>
        <div class="tag-category__options">
          <label
            v-for="tag in category.tags"
            :key="tag.id"
            class="tag-option"
            :class="{ 'tag-option--selected': modelValue.includes(tag.id) }"
          >
            <input
              :checked="modelValue.includes(tag.id)"
              :disabled="!modelValue.includes(tag.id) && modelValue.length >= max"
              type="checkbox"
              @change="toggleTag(tag.id)"
            >
            <span>
              <strong>#{{ tag.name_zh }}</strong>
              <small>{{ tag.name_en }}</small>
            </span>
          </label>
        </div>
      </section>
    </div>

    <p v-else class="muted">No tags available.</p>
  </fieldset>
</template>
