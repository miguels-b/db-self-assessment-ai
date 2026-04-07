// cliente/src/boot/axios.js
// Replace your current axios.js with this version.
// At build time, VITE_API_URL is injected by Docker (or falls back to localhost for local dev).
 
import { boot } from 'quasar/wrappers'
import axios from 'axios'
 
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:9001'
})
 
export default boot(({ app }) => {
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
})
 
export { api }
 