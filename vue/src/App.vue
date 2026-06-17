<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const status = ref("Đang chờ...");

onMounted(async () => {
  try {
    const res = await axios.get('http://localhost:3000/test');
    status.value = res.data.message;
  } catch (err) {
    status.value = "Lỗi kết nối: " + err.message;
  }
});
</script>

<template>
  <h1>Kết quả: {{ status }}</h1>
</template>



