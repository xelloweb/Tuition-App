import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { TrainerNavigator } from "./TrainerNavigator";
import { StudentNavigator } from "./StudentNavigator";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../config/theme";

export function RootNavigator() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {role === "TRAINER" ? (
        <TrainerNavigator />
      ) : role === "STUDENT" ? (
        <StudentNavigator />
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
