<script setup>
const props = defineProps({
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
    <legend>Tags <span>(choose up to {{ max }})</span></legend>
    <label v-for="tag in tags" :key="tag.id">
      <input
        :checked="modelValue.includes(tag.id)"
        :disabled="!modelValue.includes(tag.id) && modelValue.length >= max"
        type="checkbox"
        @change="toggleTag(tag.id)"
      >
      <span>{{ tag.name_en || tag.name_zh }}</span>
    </label>
    <p v-if="!tags.length" class="muted">No tags available.</p>
  </fieldset>
</template>
