import { Tabs } from 'expo-router';
import { HouseIcon, CircleUserIcon } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HouseIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <CircleUserIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
