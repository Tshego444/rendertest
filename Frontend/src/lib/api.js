import axios from 'axios'

const api = axios.create({
  baseURL: '',            // <- relative: use Vite dev proxy in development
  timeout: 15000,
  withCredentials: false
})

// attach bearer token if present
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export default api
