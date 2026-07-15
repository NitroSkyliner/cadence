export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const offset = (d.getDay() + 6) % 7   // Mon=0 … Sun=6
  d.setDate(d.getDate() - offset)
  return d
}

export function endOfWeek(date) {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 7)            // exclusive upper bound
  return d
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function isThisWeek(date, ref = new Date()) {
  const t = new Date(date).getTime()
  return t >= startOfWeek(ref).getTime() && t < endOfWeek(ref).getTime()
}