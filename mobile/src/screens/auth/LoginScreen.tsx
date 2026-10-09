import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { theme } from "../../config/theme";
import { Button } from "../../components/Button";
import { Shield, Mail, Lock, UserCheck, GraduationCap } from "lucide-react-native";

export function LoginScreen() {
  const { login, quickDemo, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required Fields", "Please enter your staff/trainer email and password.");
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Invalid email or password.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <GraduationCap size={40} color={theme.colors.teal} />
            </View>
            <Text style={styles.title}>XELLO TUITION</Text>
            <Text style={styles.subtitle}>Staff & Academic Trainer Operations</Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@xellotuition.com"
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <Button
              title="Sign In to Portal"
              onPress={handleLogin}
              loading={isLoading}
              style={{ marginTop: theme.spacing.md }}
            />
          </View>

          {/* One-Tap Quick Demo Portals */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>QUICK ACCESS DEMO</Text>
            <Text style={styles.demoSubtitle}>Select a role to preview instant operations:</Text>

            <View style={styles.demoButtonsContainer}>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => quickDemo("ADMIN")}
                disabled={isLoading}
              >
                <Shield size={18} color={theme.colors.primary} />
                <View style={styles.demoBtnTextWrapper}>
                  <Text style={styles.demoBtnTitle}>Admin / Owner</Text>
                  <Text style={styles.demoBtnDesc}>Full platform operations & metrics</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => quickDemo("COORDINATOR")}
                disabled={isLoading}
              >
                <UserCheck size={18} color={theme.colors.purple} />
                <View style={styles.demoBtnTextWrapper}>
                  <Text style={styles.demoBtnTitle}>Academic Coordinator</Text>
                  <Text style={styles.demoBtnDesc}>Students, timetables & attendance</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoBtn, styles.demoBtnTrainer]}
                onPress={() => quickDemo("TRAINER")}
                disabled={isLoading}
              >
                <GraduationCap size={18} color={theme.colors.teal} />
                <View style={styles.demoBtnTextWrapper}>
                  <Text style={styles.demoBtnTitle}>Academic Trainer</Text>
                  <Text style={styles.demoBtnDesc}>Assigned classes & subject tracking</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: "rgba(20, 184, 166, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(20, 184, 166, 0.35)",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize["2xl"],
    fontWeight: "800",
    color: theme.colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  demoSection: {
    marginTop: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
  },
  demoTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.teal,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  demoSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  demoButtonsContainer: {
    gap: theme.spacing.sm,
  },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  demoBtnTrainer: {
    borderColor: "rgba(20, 184, 166, 0.4)",
  },
  demoBtnTextWrapper: {
    marginLeft: theme.spacing.md,
  },
  demoBtnTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "700",
    color: theme.colors.text,
  },
  demoBtnDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
