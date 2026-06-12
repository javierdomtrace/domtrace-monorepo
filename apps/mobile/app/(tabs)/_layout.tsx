import { Tabs } from 'expo-router'
import { View, Text, Platform, StyleSheet } from 'react-native'
import { theme } from '@/theme'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? theme.brand : theme.muted, fontWeight: focused ? '700' : '400' }]}>
        {label}
      </Text>
    </View>
  )
}

function StoqlyTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={[
        styles.stoqlyIcon,
        {
          backgroundColor: focused ? theme.brand : theme.surface,
          borderColor: focused ? theme.brand : theme.border,
          shadowOpacity: focused ? 0.5 : 0,
        },
      ]}
    >
      <Text style={{ fontSize: 22 }}>✦</Text>
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Despensa" focused={focused} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" label="Alertas" focused={focused} /> }}
      />
      <Tabs.Screen
        name="stoqly"
        options={{ tabBarIcon: ({ focused }) => <StoqlyTabIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="shopping"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="Compra" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Ajustes" focused={focused} /> }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabIcon:    { alignItems: 'center', paddingTop: 4 },
  tabLabel:   { fontSize: 10, marginTop: 2 },
  stoqlyIcon: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 16,
    width: 56, height: 56, marginTop: -20,
    borderWidth: 2,
    shadowColor: theme.brand, shadowRadius: 12, elevation: 8,
  },
})
