import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../config/theme";
import { TrainerDashboardScreen } from "../screens/trainer/TrainerDashboardScreen";
import { TrainerStudentsScreen } from "../screens/trainer/TrainerStudentsScreen";
import { TrainerScheduleScreen } from "../screens/trainer/TrainerScheduleScreen";
import { TrainerProfileScreen } from "../screens/trainer/TrainerProfileScreen";
import { TrainerStudentDetailScreen } from "../screens/trainer/TrainerStudentDetailScreen";
import { MarkAttendanceScreen } from "../screens/trainer/MarkAttendanceScreen";
import { LayoutDashboard, Users, Calendar, User } from "lucide-react-native";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TrainerTabs() {
  // Room for the iPhone home indicator / Android gesture bar below the tabs.
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.cardBorder,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={TrainerDashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="MyStudents"
        component={TrainerStudentsScreen}
        options={{
          tabBarLabel: "My Students",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={TrainerScheduleScreen}
        options={{
          tabBarLabel: "Schedule",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={TrainerProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function TrainerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrainerTabs" component={TrainerTabs} />
      <Stack.Screen name="TrainerStudentDetail" component={TrainerStudentDetailScreen} />
      <Stack.Screen
        name="MarkAttendance"
        component={MarkAttendanceScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}
