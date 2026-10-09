import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Header } from "../../components/Header";
import { StatCard } from "../../components/StatCard";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../config/api";
import {
  Users,
  Calendar,
  Clock,
  CheckCircle,
  Clock3,
  ChevronRight,
  BookOpen,
} from "lucide-react-native";

interface DashboardData {
  success?: boolean;
  stats: {
    assignedStudentsCount: number;
    todayClassesCount: number;
    completedClassesThisMonth: number;
    totalHoursThisMonth: number;
  };
  todaySessions: Array<{
    id: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    grade?: string;
    subjectName: string;
    subjectColor?: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isAttendanceMarked: boolean;
    attendanceOutcome?: string | null;
    studentAttendance?: string | null;
    topicCovered?: string | null;
  }>;
}

export function TrainerDashboardScreen({ navigation }: any) {
  const { trainer, token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    if (!trainer?.teacherId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<DashboardData>(
        `/api/mobile/trainer/dashboard?teacherId=${trainer.teacherId}`,
        { token }
      );
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.log("Error loading dashboard data, using local mock data", err);
      // Fallback sample data for demo preview
      setData({
        stats: {
          assignedStudentsCount: 6,
          todayClassesCount: 3,
          completedClassesThisMonth: 18,
          totalHoursThisMonth: 18.0,
        },
        todaySessions: [
          {
            id: "sess-1",
            studentId: "s-1",
            studentName: "Slaine",
            studentCode: "XST-131",
            grade: "10th Grade",
            subjectName: "Mathematics",
            subjectColor: "#14b8a6",
            startTime: new Date(new Date().setHours(17, 30, 0, 0)).toISOString(),
            endTime: new Date(new Date().setHours(18, 30, 0, 0)).toISOString(),
            durationMinutes: 60,
            isAttendanceMarked: false,
          },
          {
            id: "sess-2",
            studentId: "s-2",
            studentName: "Mridul. S",
            studentCode: "XST-132",
            grade: "6th Grade",
            subjectName: "Mathematics",
            subjectColor: "#14b8a6",
            startTime: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(),
            endTime: new Date(new Date().setHours(21, 0, 0, 0)).toISOString(),
            durationMinutes: 60,
            isAttendanceMarked: false,
          },
          {
            id: "sess-3",
            studentId: "s-3",
            studentName: "Dharmika SA",
            studentCode: "XST-121",
            grade: "8th Grade",
            subjectName: "Physics",
            subjectColor: "#6366f1",
            startTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
            endTime: new Date(new Date().setHours(16, 0, 0, 0)).toISOString(),
            durationMinutes: 60,
            isAttendanceMarked: true,
            attendanceOutcome: "COMPLETED",
            studentAttendance: "PRESENT",
            topicCovered: "Linear Equations & Word Problems",
          },
        ],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [trainer?.teacherId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Trainer Dashboard"
        subtitle={`Welcome back, ${trainer?.name || "Trainer"}`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Metric Cards Row */}
        <View style={styles.statsRow}>
          <StatCard
            label="My Students"
            value={data?.stats.assignedStudentsCount ?? 0}
            color={Colors.primary}
            icon={<Users size={16} color={Colors.primary} />}
          />
          <StatCard
            label="Today's Classes"
            value={data?.stats.todayClassesCount ?? 0}
            color={Colors.warning}
            icon={<Calendar size={16} color={Colors.warning} />}
          />
          <StatCard
            label="Hours Taught"
            value={`${data?.stats.totalHoursThisMonth ?? 0}h`}
            color={Colors.success}
            icon={<Clock size={16} color={Colors.success} />}
          />
        </View>

        {/* Today's Classes Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock3 size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Today&apos;s Scheduled Classes</Text>
          </View>
          <Text style={styles.sectionCounter}>
            {data?.todaySessions.length ?? 0} classes
          </Text>
        </View>

        {/* Classes List */}
        {!data?.todaySessions || data.todaySessions.length === 0 ? (
          <EmptyState
            title="No Classes Scheduled Today"
            message="You have no classes scheduled on your timetable for today."
            icon={<Calendar size={40} color={Colors.textMuted} />}
          />
        ) : (
          data.todaySessions.map((session) => (
            <Card key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View>
                  <View style={styles.studentNameRow}>
                    <Text style={styles.studentName}>{session.studentName}</Text>
                    <Text style={styles.studentCode}>({session.studentCode})</Text>
                  </View>
                  {session.grade && <Text style={styles.studentGrade}>{session.grade}</Text>}
                </View>

                <Badge
                  label={session.subjectName}
                  color={session.subjectColor || Colors.primary}
                />
              </View>

              <View style={styles.sessionTimeRow}>
                <View style={styles.timeTag}>
                  <Clock size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.timeText}>
                    {formatTime(session.startTime)} – {formatTime(session.endTime)} (IST)
                  </Text>
                </View>

                <Text style={styles.durationText}>{session.durationMinutes} mins</Text>
              </View>

              {session.isAttendanceMarked ? (
                <View style={styles.markedContainer}>
                  <View style={styles.markedHeader}>
                    <CheckCircle size={14} color={Colors.success} />
                    <Text style={styles.markedText}>
                      Attendance Recorded: {session.studentAttendance}
                    </Text>
                  </View>
                  {session.topicCovered && (
                    <Text style={styles.topicText}>Topic: {session.topicCovered}</Text>
                  )}
                </View>
              ) : (
                <Button
                  title="Mark Class Attendance"
                  size="sm"
                  onPress={() =>
                    navigation.navigate("MarkAttendance", {
                      sessionId: session.id,
                      studentName: session.studentName,
                      studentCode: session.studentCode,
                      subjectName: session.subjectName,
                      onSuccess: onRefresh,
                    })
                  }
                  style={styles.markButton}
                />
              )}
            </Card>
          ))
        )}

        {/* Quick Shortcut to Assigned Students */}
        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => navigation.navigate("MyStudents")}
          activeOpacity={0.8}
        >
          <View style={styles.shortcutLeft}>
            <View style={styles.shortcutIconContainer}>
              <BookOpen size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.shortcutTitle}>View My Students Directory</Text>
              <Text style={styles.shortcutSub}>
                Check remaining credits & contact details for assigned subjects
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginLeft: 6,
  },
  sectionCounter: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  sessionCard: {
    marginBottom: Spacing.md,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  studentNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  studentCode: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
    marginLeft: 4,
  },
  studentGrade: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sessionTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  markedContainer: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  markedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  markedText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
    marginLeft: 6,
  },
  topicText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  markButton: {
    marginTop: Spacing.xs,
  },
  shortcutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  shortcutLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: Spacing.sm,
  },
  shortcutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  shortcutSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
