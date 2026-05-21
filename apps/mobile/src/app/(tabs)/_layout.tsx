import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Platform } from 'react-native'

type IconName = keyof typeof Ionicons.glyphMap

const TABS: Array<{ name: string; title: string; icon: IconName; iconFocused: IconName }> = [
  { name: 'index', title: 'Dashboard', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'events', title: 'Events', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'guests', title: 'Guests', icon: 'people-outline', iconFocused: 'people' },
  { name: 'tasks', title: 'Tasks', icon: 'checkmark-circle-outline', iconFocused: 'checkmark-circle' },
  { name: 'notifications', title: 'Alerts', icon: 'notifications-outline', iconFocused: 'notifications' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconFocused: 'person' },
]

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#1f1f1f',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#71717a',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
