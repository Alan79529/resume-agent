/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB'
        },
        status: {
          pending: '#9CA3AF',
          preparing: '#3B82F6',
          scheduled: '#F59E0B',
          interviewed: '#10B981',
          reviewed: '#059669'
        }
      }
    }
  },
  plugins: []
}
