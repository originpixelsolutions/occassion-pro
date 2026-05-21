import { Stack } from 'expo-router'

/**
 * OccasionPro — Settings Stack Navigator
 *
 * All /settings/* screens share this stack with a consistent
 * dark header style that matches the rest of the app.
 */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0a0a0a',
        },
        headerTintColor: '#fafafa',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    />
  )
}
