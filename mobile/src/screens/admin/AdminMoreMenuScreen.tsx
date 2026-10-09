import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import {
  Users,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Inbox,
  Layers,
  Receipt,
  DollarSign,
  BarChart3,
  Shield,
  FileText,
  ChevronRight,
  LogOut,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";

export function AdminMoreMenuScreen({ navigation }: any) {
  const { logout, user } = useAuth();

  const MODULE_SECTIONS = [
    {
      title: "ACADEMICS",
      items: [
        {
          label: "Students Directory",
          desc: "Active profiles, grades & admissions",
          icon: Users,
          color: theme.colors.brandCyan,
          onPress: () => navigation.navigate("AdminStudents"),
        },
        {
          label: "Trainers & Staff",
          desc: "Academic faculty, subjects & hourly rates",
          icon: GraduationCap,
          color: theme.colors.brandLime,
          onPress: () => navigation.navigate("AdminTeachers"),
        },
        {
          label: "Admissions & Intake",
          desc: "Parent applications & public apply link",
          icon: Inbox,
          color: "#f59e0b",
          onPress: () => navigation.navigate("AdminAdmissions"),
        },
        {
          label: "Weekly Timetable",
          desc: "Class schedules by day and week (IST)",
          icon: Calendar,
          color: theme.colors.brandCyan,
          onPress: () => navigation.navigate("AdminTimetable"),
        },
        {
          label: "Attendance Manager",
          desc: "Review logs, missing attendance & record",
          icon: CheckCircle2,
          color: "#10b981",
          onPress: () => navigation.navigate("AdminAttendance"),
        },
        {
          label: "Packages & Credits",
          desc: "Class credit balances and expiry tracking",
          icon: Layers,
          color: "#8b5cf6",
          onPress: () => navigation.navigate("AdminPackages"),
        },
      ],
    },
    {
      title: "FINANCE & BILLING",
      items: [
        {
          label: "Invoices & Payments",
          desc: "Student invoices, receipts & mark paid",
          icon: Receipt,
          color: theme.colors.brandLime,
          onPress: () => navigation.navigate("AdminBilling"),
        },
        {
          label: "Trainer Payouts",
          desc: "Monthly teaching hours & earnings",
          icon: DollarSign,
          color: theme.colors.brandCyan,
          onPress: () => navigation.navigate("AdminPayouts"),
        },
      ],
    },
    {
      title: "ADMIN & SETTINGS",
      items: [
        {
          label: "Reports & Analytics",
          desc: "Revenue totals, teaching hours & metrics",
          icon: BarChart3,
          color: theme.colors.brandCyan,
          onPress: () => navigation.navigate("AdminReports"),
        },
        {
          label: "Security & Profile",
          desc: "Account details & center operations",
          icon: Shield,
          color: theme.colors.brandLime,
          onPress: () => navigation.navigate("AdminProfile"),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="All Modules" subtitle="Complete tuition operations hub" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {MODULE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => {
                const Icon = item.icon;
                const isLast = idx === section.items.length - 1;

                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.itemRow, !isLast && styles.itemRowBorder]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${item.color}15` }]}>
                      <Icon size={20} color={item.color} />
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.itemDesc}>{item.desc}</Text>
                    </View>
                    <ChevronRight size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={logout} activeOpacity={0.7}>
          <LogOut size={18} color={theme.colors.danger} />
          <Text style={styles.signOutText}>Sign Out of Portal</Text>
        </TouchableOpacity>
      </ScrollView>
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
    gap: theme.spacing.xl,
    paddingBottom: 40,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.brandCyan,
    letterSpacing: 1.5,
    paddingLeft: 4,
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },
  itemDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
    gap: 8,
    marginTop: theme.spacing.md,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.danger,
  },
});
