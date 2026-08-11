import { useState, useEffect, useCallback } from 'react'
import { API } from './api.js'

export function useCategories() {
  const [categories, setCategories] = useState([])

  const load = useCallback(async () => {
    try { setCategories(await (await fetch(`${API}/categories`)).json()) }
    catch (err) { console.error('Failed to load categories:', err) }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (name, color) => {
    const res = await fetch(`${API}/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }),
    })
    await load()
    return res.ok ? res.json() : null
  }, [load])

  const remove = useCallback(async (id) => {
    await fetch(`${API}/categories/${id}`, { method: 'DELETE' })
    await load()
  }, [load])

  return { categories, reloadCategories: load, createCategory: create, deleteCategory: remove }
}