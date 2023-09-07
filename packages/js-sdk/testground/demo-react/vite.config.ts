import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    E2B_API_KEY: JSON.stringify(process.env.E2B_API_KEY),
  },
})
