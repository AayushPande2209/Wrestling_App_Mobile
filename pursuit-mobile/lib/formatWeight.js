export function formatWeight(value) {
  const n = parseFloat(value)
  if (isNaN(n)) return '—'
  return n.toFixed(1)
}

export function formatTimeOfDay(value) {
  if (!value) return '—'
  const map = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    night: 'Night',
    before_practice: 'Afternoon',
    after_practice: 'Afternoon',
  }
  return map[value] ?? value.replace(/_/g, ' ')
}
