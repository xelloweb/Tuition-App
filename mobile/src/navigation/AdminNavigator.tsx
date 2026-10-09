import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../config/theme";
import { canOpenScreen } from "../config/access";
import { useAuth } from "../context/AuthContext";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminStudentsScreen } from "../screens/admin/AdminStudentsScreen";
import { AdminTimetableScreen } from "../screens/admin/AdminTimetableScreen";
import { AdminBillingScreen } from "../screens/admin/AdminBillingScreen";
import { AdminMoreMenuScreen } from "../screens/admin/AdminMoreMenuScreen";
import { AdminTeachersScreen } from "../screens/admin/AdminTeachersScreen";
import { AdminAttendanceScreen } from "../screens/admin/AdminAttendanceScreen";
import { AdminAdmissionsScreen } from "../screens/admin/AdminAdmissionsScreen";
import { AdminPackagesScreen } from "../screens/admin/AdminPackagesScreen";
import { AdminPayoutsScreen } from "../screens/admin/AdminPayoutsScreen";
import { AdminReportsScreen } from "../screens/admin/AdminReportsScreen";
import { AdminProfileScreen } from "../screens/admin/AdminProfileScreen";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Receipt,
  Layers,
} from "lucide-react-native";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminTabs() {
  const { user } = useAuth();
  const show = (screen: string) => canOpenScreen(user?.role, screen);
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
        tabBarActiveTintColor: theme.colors.brandCyan,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
      }}
    >
      {show("AdminDashboard") && (
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
      )}
      {show("AdminStudents") && (
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
      )}
      {show("AdminTimetable") && (
        <Tab.Screen
          name="AdminTimetable"
          component={AdminTimetableScreen}
          options={{
            tabBarLabel: "Timetable",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Calendar size={size} color={color} />
            ),
          }}
        />
      )}
      {show("AdminBilling") && (
        <Tab.Screen
          name="AdminBilling"
          component={AdminBillingScreen}
          options={{
            tabBarLabel: "Invoices",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Receipt size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="AdminMoreMenu"
        component={AdminMoreMenuScreen}
        options={{
          tabBarLabel: "All Modules",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Layers size={size} color={color} />
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
      <Stack.Screen name="AdminTeachers" component={AdminTeachersScreen} />
      <Stack.Screen name="AdminAttendance" component={AdminAttendanceScreen} />
      <Stack.Screen name="AdminAdmissions" component={AdminAdmissionsScreen} />
      <Stack.Screen name="AdminPackages" component={AdminPackagesScreen} />
      <Stack.Screen name="AdminPayouts" component={AdminPayoutsScreen} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
    </Stack.Navigator>
  );
}
