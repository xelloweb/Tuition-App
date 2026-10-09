import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../config/theme";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminStudentsScreen } from "../screens/admin/AdminStudentsScreen";
import { AdminTeachersScreen } from "../screens/admin/AdminTeachersScreen";
import { AdminProfileScreen } from "../screens/admin/AdminProfileScreen";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Shield,
} from "lucide-react-native";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.teal,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminStudents"
        component={AdminStudentsScreen}
        options={{
          tabBarLabel: "Students",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminTeachers"
        component={AdminTeachersScreen}
        options={{
          tabBarLabel: "Trainers",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <GraduationCap size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Shield size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
    </Stack.Navigator>
  );
}
