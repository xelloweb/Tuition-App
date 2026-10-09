import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { TrainerNavigator } from "./TrainerNavigator";
import { AdminNavigator } from "./AdminNavigator";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { theme } from "../config/theme";

export function RootNavigator() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.teal} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {role === "TRAINER" ? (
        <TrainerNavigator />
      ) : role === "ADMIN" || role === "COORDINATOR" ? (
        <AdminNavigator />
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
