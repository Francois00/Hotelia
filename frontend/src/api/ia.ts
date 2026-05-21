import axios from "axios"

const ia = axios.create({ baseURL: import.meta.env.VITE_IA_URL ?? "http://localhost:8001" })

ia.interceptors.request.use(config => {
  const key = import.meta.env.VITE_IA_KEY ?? ""
  if (key) config.headers["X-IA-Key"] = key
  return config
})

export default ia
