// export const API = 'http://localhost:8000'
export const API = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')