/**
 * Returns a time-based greeting string.
 * 5:00am–11:59am  → Good Morning
 * 12:00pm–4:59pm  → Good Afternoon
 * 5:00pm–8:59pm   → Good Evening
 * 9:00pm–4:59am   → Good Night
 */
export function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good Morning'
  if (h >= 12 && h < 17) return 'Good Afternoon'
  if (h >= 17 && h < 21) return 'Good Evening'
  return 'Good Night'
}

/**
 * Returns the greeting emoji appropriate for the time.
 */
export function getGreetingEmoji(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return '☀️'
  if (h >= 12 && h < 17) return '👋'
  if (h >= 17 && h < 21) return '🌆'
  return '🌙'
}
