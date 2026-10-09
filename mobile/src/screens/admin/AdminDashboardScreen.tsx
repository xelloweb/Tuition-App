import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../config/api";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { StatCard } from "../../components/StatCard";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import {
  Users,
  GraduationCap,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react-native";

export function AdminDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await apiRequest("/api/mobile/admin/dashboard");
      setData(res);
    } catch (err) {
      console.error("Failed to load admin dashboard", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Admin Operations"
        subtitle={`Welcome, ${user?.name || "Admin"}`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.teal} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.teal} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* KPI Stat Cards Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard
                  title="Active Students"
                  value={data?.stats?.totalStudents ?? 0}
                  icon={<Users size={20} color={theme.colors.teal} />}
                  color={theme.colors.teal}
                />
                <StatCard
                  title="Active Trainers"
                  value={data?.stats?.totalTeachers ?? 0}
                  icon={<GraduationCap size={20} color={theme.colors.primary} />}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  title="Today's Classes"
                  value={data?.stats?.todayClassesCount ?? 0}
                  icon={<Calendar size={20} color={theme.colors.purple} />}
                  color={theme.colors.purple}
                />
                <StatCard
                  title="Missing Attendance"
                  value={data?.stats?.missingAttendanceCount ?? 0}
                  icon={<AlertCircle size={20} color={theme.colors.danger} />}
                  color={theme.colors.danger}
                />
              </View>
            </View>

            {/* Teaching Hours Stat */}
            <Card style={styles.monthHoursCard}>
              <View style={styles.monthHoursHeader}>
                <Clock size={20} color={theme.colors.teal} />
                <Text style={styles.monthHoursTitle}>Teaching Hours Delivered This Month</Text>
              </View>
              <Text style={styles.monthHoursValue}>
                {data?.stats?.totalHoursThisMonth ?? 0} <Text style={{ fontSize: 16, color: theme.colors.textMuted }}>Hours</Text>
              </Text>
              <Text style={styles.monthHoursSub}>
                {data?.stats?.completedClassesThisMonth ?? 0} completed classes across all subjects
              </Text>
            </Card>

            {/* Today's Schedule Overview */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TODAY'S SCHEDULED SESSIONS</Text>
            </View>

            {data?.todaySessions && data.todaySessions.length > 0 ? (
              data.todaySessions.map((session: any) => (
                <Card key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionStudent}>{session.studentName}</Text>
                      <Text style={styles.sessionTeacher}>Trainer: {session.teacherName}</Text>
                    </View>
                    <Badge label={session.subjectName} color={session.subjectColor} />
                  </View>
                  <View style={styles.sessionBottom}>
                    <Text style={styles.sessionTime}>
                      {new Date(session.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    {session.isAttendanceMarked ? (
                      <View style={styles.attendanceDone}>
                        <CheckCircle2 size={14} color={theme.colors.success} />
                        <Text style={styles.attendanceDoneText}>Marked</Text>
                      </View>
                    ) : (
                      <View style={styles.attendancePending}>
                        <Clock size={14} color={theme.colors.warning} />
                        <Text style={styles.attendancePendingText}>Pending</Text>
                      </View>
                    )}
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>No classes scheduled for today.</Text>
              </Card>
            )}
          </>
        )}
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
  },
  statsGrid: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  monthHoursCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  monthHoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  monthHoursTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  monthHoursValue: {
    fontSize: theme.fontSize["3xl"],
    fontWeight: "800",
    color: theme.colors.teal,
    marginTop: theme.spacing.xs,
  },
  monthHoursSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  sessionCard: {
    marginBottom: theme.spacing.sm,
  },
  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sessionStudent: {
    fontSize: theme.fontSize.base,
    fontWeight: "700",
    color: theme.colors.text,
  },
  sessionTeacher: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  sessionBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  sessionTime: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  attendanceDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attendanceDoneText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    fontWeight: "600",
  },
  attendancePending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attendancePendingText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.warning,
    fontWeight: "600",
  },
  emptyCard: {
    padding: theme.spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
});
