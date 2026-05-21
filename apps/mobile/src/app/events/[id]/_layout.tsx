import { Stack } from 'expo-router'

export default function EventLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="guests" />
      <Stack.Screen name="checkin" />
      <Stack.Screen name="runsheet" />
      <Stack.Screen name="notifications" />
    </Stack>
  )
}
