<script setup>
defineProps({
  modelValue: {
    type: Number,
    default: 0,
  },
  label: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <fieldset class="rating-input">
    <legend>{{ label }}</legend>
    <label v-for="value in 5" :key="value">
      <input
        :checked="modelValue === value"
        :name="name"
        :value="value"
        type="radio"
        required
        @change="$emit('update:modelValue', value)"
      >
      <span>{{ value }}</span>
    </label>
  </fieldset>
</template>
