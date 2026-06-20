export const TAG_CATEGORIES = [
  { key: 'workload', label: 'Workload' },
  { key: 'teacher_behavior', label: 'Teacher Behavior' },
  { key: 'exams', label: 'Exams' },
  { key: 'grading', label: 'Grading' },
  { key: 'classroom_environment', label: 'Classroom Environment' },
];

export const TAG_DEFINITIONS = [
  { name_zh: '作業很多', name_en: 'Heavy Workload', category: 'workload' },
  { name_zh: '作業適中', name_en: 'Moderate Workload', category: 'workload' },
  { name_zh: '作業很少', name_en: 'Light Workload', category: 'workload' },
  { name_zh: '報告很多', name_en: 'Many Presentations', category: 'workload' },

  { name_zh: '老師親切', name_en: 'Friendly Teacher', category: 'teacher_behavior' },
  { name_zh: '老師嚴格', name_en: 'Strict Teacher', category: 'teacher_behavior' },
  { name_zh: '講解清楚', name_en: 'Clear Explanations', category: 'teacher_behavior' },
  { name_zh: '講解含糊', name_en: 'Unclear Explanations', category: 'teacher_behavior' },

  { name_zh: '考試容易', name_en: 'Easy Exams', category: 'exams' },
  { name_zh: '考試困難', name_en: 'Hard Exams', category: 'exams' },
  { name_zh: '開書考試', name_en: 'Open-book Exams', category: 'exams' },
  { name_zh: '理論', name_en: 'Theory-heavy', category: 'exams' },

  { name_zh: '推薦', name_en: 'Recommended', category: 'grading' },
  { name_zh: '不推薦', name_en: 'Not Recommended', category: 'grading' },
  { name_zh: '甜分高', name_en: 'Easy Grading', category: 'grading' },
  { name_zh: '實用', name_en: 'Practical', category: 'grading' },

  { name_zh: '點名嚴格', name_en: 'Strict Attendance', category: 'classroom_environment' },
  { name_zh: '不點名', name_en: 'No Attendance Check', category: 'classroom_environment' },
  { name_zh: '冷氣冷', name_en: 'Strong AC', category: 'classroom_environment' },
  { name_zh: '冷氣弱', name_en: 'Weak AC', category: 'classroom_environment' },
];
