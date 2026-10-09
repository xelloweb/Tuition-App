import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { GraduationCap, BookOpen, Key, Mail, Phone, Sparkles } from "lucide-react-native";

export function LoginScreen() {
  const { loginTrainer, loginStudent, quickDemoTrainer, quickDemoStudent, isLoading } = useAuth();
  const [tab, setTab] = useState<"TRAINER" | "STUDENT">("TRAINER");

  // Trainer state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Student state
  const [studentCode, setStudentCode] = useState("");
  const [phone, setPhone] = useState("");

  const handleTrainerLogin = async () => {
    if (!email || !password) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }
    try {
      await loginTrainer(email, password);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Invalid credentials.");
    }
  };

  const handleStudentLogin = async () => {
    if (!studentCode) {
      Alert.alert("Required", "Please enter your Student ID (e.g. XST-131).");
      return;
    }
    try {
      await loginStudent(studentCode, phone);
    } catch (err: any) {
      Alert.alert("Access Failed", err.message || "Could not find student record.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* App Branding Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <GraduationCap size={32} color={Colors.primary} />
          </View>
          <Text style={styles.brandTitle}>XELLO TUITION</Text>
          <Text style={styles.brandSubtitle}>Personalized One-on-One Tuition Portal</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, tab === "TRAINER" && styles.tabButtonActive]}
            onPress={() => setTab("TRAINER")}
            activeOpacity={0.8}
          >
            <BookOpen size={16} color={tab === "TRAINER" ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, tab === "TRAINER" && styles.tabTextActive]}>Trainer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === "STUDENT" && styles.tabButtonActive]}
            onPress={() => setTab("STUDENT")}
            activeOpacity={0.8}
          >
            <GraduationCap size={16} color={tab === "STUDENT" ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabText, tab === "STUDENT" && styles.tabTextActive]}>Student / Parent</Text>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {tab === "TRAINER" ? (
            <>
              <Text style={styles.formTitle}>Trainer Sign In</Text>
              <Text style={styles.formSubtitle}>
                Manage your assigned subjects, mark attendance, and track classes.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Trainer Email</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="trainer@xellotuition.com"
                    placeholderTextColor={Colors.textMuted}
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
                  <Key size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter password"
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              <Button
                title="Sign In as Trainer"
                onPress={handleTrainerLogin}
                loading={isLoading}
                style={{ marginTop: Spacing.md }}
              />
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Student & Parent Portal</Text>
              <Text style={styles.formSubtitle}>
                View class progress, attended topics, homework, and weekly timetable.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Student ID *</Text>
                <View style={styles.inputWrapper}>
                  <GraduationCap size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. XST-131 or 131"
                    placeholderTextColor={Colors.textMuted}
                    value={studentCode}
                    onChangeText={setStudentCode}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Registered WhatsApp (Optional)</Text>
                <View style={styles.inputWrapper}>
                  <Phone size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Last 4 digits or full phone number"
                    placeholderTextColor={Colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Button
                title="Access Student Portal"
                onPress={handleStudentLogin}
                loading={isLoading}
                style={{ marginTop: Spacing.md }}
              />
            </>
          )}
        </View>

        {/* Quick Demo Section */}
        <View style={styles.demoSection}>
          <View style={styles.demoHeaderRow}>
            <Sparkles size={16} color={Colors.warning} />
            <Text style={styles.demoTitle}>Quick Demo Preview</Text>
          </View>
          <Text style={styles.demoDescription}>
            Instant one-tap access with sample live data to test both experiences:
          </Text>

          <View style={styles.demoButtonsRow}>
            <Button
              title="Demo Trainer View"
              variant="secondary"
              size="sm"
              onPress={quickDemoTrainer}
              style={{ flex: 1, marginRight: Spacing.xs }}
            />
            <Button
              title="Demo Student View"
              variant="secondary"
              size="sm"
              onPress={quickDemoStudent}
              style={{ flex: 1, marginLeft: Spacing.xs }}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxxl * 1.5,
    paddingBottom: Spacing.xxxl,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(20, 184, 166, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  tabButtonActive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textMuted,
    marginLeft: 6,
  },
  tabTextActive: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: Platform.OS === "ios" ? Spacing.md : Spacing.sm,
  },
  demoSection: {
    marginTop: Spacing.xxl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  demoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.warning,
    marginLeft: 6,
  },
  demoDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  demoButtonsRow: {
    flexDirection: "row",
  },
});
