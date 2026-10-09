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
  Image,
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

  const handleDemo = async (demoRole: "ADMIN" | "COORDINATOR" | "TRAINER") => {
    try {
      await quickDemo(demoRole);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "The demo account is not available on this server.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Official Xello Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Image
                source={require("../../../assets/icon.png")}
                style={styles.brandIcon}
                resizeMode="contain"
              />
            </View>
            <Image
              source={require("../../../assets/xello-logo.png")}
              style={styles.brandWordmark}
              resizeMode="contain"
            />
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

          {/* One-tap demo accounts: development builds only. Installed apps always sign in with a real account. */}
          {__DEV__ && (
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>STAFF PORTAL ACCESS</Text>
            <Text style={styles.demoSubtitle}>Select a role to preview instant operations:</Text>

            <View style={styles.demoButtonsContainer}>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleDemo("ADMIN")}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconWrap, { backgroundColor: "rgba(64, 174, 227, 0.15)" }]}>
                  <Shield size={20} color={theme.colors.brandCyan} />
                </View>
                <View style={styles.demoBtnTextWrapper}>
                  <Text style={styles.demoBtnTitle}>Admin / Owner</Text>
                  <Text style={styles.demoBtnDesc}>Full platform operations & metrics</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleDemo("COORDINATOR")}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconWrap, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                  <UserCheck size={20} color={theme.colors.purple} />
                </View>
                <View style={styles.demoBtnTextWrapper}>
                  <Text style={styles.demoBtnTitle}>Academic Coordinator</Text>
                  <Text style={styles.demoBtnDesc}>Students, timetables & attendance</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoBtn, styles.demoBtnTrainer]}
                onPress={() => handleDemo("TRAINER")}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconWrap, { backgroundColor: "rgba(203, 220, 66, 0.15)" }]}>
                  <GraduationCap size={20} color={theme.colors.brandLime} />
                </View>
                <View style={styles.demoBtnTextWrapper}>
                  <Text style={styles.demoBtnTitle}>Academic Trainer</Text>
                  <Text style={styles.demoBtnDesc}>Assigned classes & subject tracking</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          )}

          <View style={styles.footerNote}>
            <Text style={styles.footerText}>
              Xello Tuition Management Platform • Confidential Staff Access
            </Text>
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
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#16194f",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: "rgba(64, 174, 227, 0.35)",
    shadowColor: "#40aee3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  brandIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  brandWordmark: {
    width: 150,
    height: 44,
    marginTop: 4,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 6,
    fontWeight: "500",
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
    fontWeight: "800",
    color: theme.colors.brandCyan,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  demoSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 3,
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
    minHeight: 56,
  },
  demoBtnTrainer: {
    borderColor: "rgba(203, 220, 66, 0.35)",
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  demoBtnTextWrapper: {
    marginLeft: theme.spacing.md,
    flex: 1,
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
  footerNote: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});
