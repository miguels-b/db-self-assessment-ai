import { boot } from 'quasar/wrappers'
import axios from 'axios'

// La dirección base de tu backend en Node.js
const api = axios.create({ baseURL: 'http://localhost:9001' })

export default boot(({ app }) => {
  // para usar dentro de los archivos Vue, ej. this.$api
  app.config.globalProperties.$api = api
  
})

export { api }
