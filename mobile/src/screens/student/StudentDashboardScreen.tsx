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
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../config/api";
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle,
  FileText,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";

interface StudentDashboardData {
  student: {
    id: string;
    name: string;
    studentCode: string;
    grade?: string;
    board?: string;
    guardianName?: string;
    whatsappNumber?: string;
    enrolledSubjects: Array<{
      subjectId: string;
      subjectName: string;
      subjectColor?: string;
      teacherName: string;
    }>;
  };
  package?: {
    name: string;
    totalClasses: number;
    attendedClasses: number;
    remainingClasses: number;
    progressPercentage: number;
  } | null;
  nextSession?: {
    id: string;
    subjectName: string;
    subjectColor?: string;
    teacherName: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  } | null;
  recentClasses: Array<{
    id: string;
    date: string;
    subjectName: string;
    subjectColor?: string;
    teacherName: string;
    topicCovered: string;
    homework?: string | null;
    studentProgressNote?: string | null;
    studentAttendance: string;
    durationMinutes: number;
  }>;
}

export function StudentDashboardScreen({ navigation }: any) {
  const { student, token } = useAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    if (!student?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<StudentDashboardData>(
        `/api/mobile/student/dashboard?studentId=${student.id}`,
        { token }
      );
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.log("Using mock student dashboard for preview", err);
      setData({
        student: {
          id: student.id,
          name: student.name,
          studentCode: student.studentCode,
          grade: student.grade || "10th Grade",
          board: student.board || "CBSE",
          guardianName: student.guardianName || "Parent",
          whatsappNumber: student.whatsappNumber || "+965 9446511500",
          enrolledSubjects: [
            { subjectId: "sub-1", subjectName: "Mathematics", subjectColor: "#14b8a6", teacherName: "Sumi Varghese" },
            { subjectId: "sub-2", subjectName: "Science", subjectColor: "#6366f1", teacherName: "Anu George" },
          ],
        },
        package: {
          name: "12 Classes - Monthly Package",
          totalClasses: 12,
          attendedClasses: 3,
          remainingClasses: 9,
          progressPercentage: 25,
        },
        nextSession: {
          id: "s-1",
          subjectName: "Mathematics",
          subjectColor: "#14b8a6",
          teacherName: "Sumi Varghese",
          startTime: new Date(new Date().setHours(17, 30, 0, 0)).toISOString(),
          endTime: new Date(new Date().setHours(18, 30, 0, 0)).toISOString(),
          durationMinutes: 60,
        },
        recentClasses: [
          {
            id: "rec-1",
            date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
            subjectName: "Mathematics",
            subjectColor: "#14b8a6",
            teacherName: "Sumi Varghese",
            topicCovered: "Linear Equations & Word Problem Solving",
            homework: "Complete Exercise 3.2 problems 1 to 5",
            studentProgressNote: "Excellent understanding of substitution method today.",
            studentAttendance: "PRESENT",
            durationMinutes: 60,
          },
          {
            id: "rec-2",
            date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
            subjectName: "Science",
            subjectColor: "#6366f1",
            teacherName: "Anu George",
            topicCovered: "Acids, Bases and Salts - Part 1",
            homework: "Read Chapter 2 and prepare formula notes",
            studentProgressNote: "Good engagement in chemical reaction discussions.",
            studentAttendance: "PRESENT",
            durationMinutes: 60,
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
  }, [student?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Student Portal"
        subtitle={`Welcome, ${data?.student.name || student?.name || "Student"}`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Student Badge Card */}
        <Card style={styles.studentBadgeCard}>
          <View style={styles.studentHeaderRow}>
            <View style={styles.avatar}>
              <GraduationCap size={28} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.studentName}>{data?.student.name || student?.name}</Text>
              <Text style={styles.studentMeta}>
                {data?.student.grade || student?.grade} • {data?.student.board || student?.board || "CBSE"}
              </Text>
            </View>
            <Badge label={data?.student.studentCode || student?.studentCode || "XST"} size="sm" />
          </View>
        </Card>

        {/* Package Class Balance Progress */}
        {data?.package && (
          <Card style={styles.packageCard}>
            <View style={styles.packageHeader}>
              <View>
                <Text style={styles.packageTitle}>{data.package.name}</Text>
                <Text style={styles.packageSub}>Package Class Balance</Text>
              </View>
              <View style={styles.remainingPill}>
                <Text style={styles.remainingNumber}>{data.package.remainingClasses}</Text>
                <Text style={styles.remainingLabel}>Left</Text>
              </View>
            </View>

            {/* Visual Progress Bar */}
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, Math.max(5, data.package.progressPercentage))}%` },
                ]}
              />
            </View>

            <View style={styles.progressStatsRow}>
              <Text style={styles.progressStatText}>
                Attended: <Text style={styles.progressHighlight}>{data.package.attendedClasses}</Text> classes
              </Text>
              <Text style={styles.progressStatText}>
                Total: <Text style={styles.progressHighlight}>{data.package.totalClasses}</Text> classes
              </Text>
            </View>
          </Card>
        )}

        {/* Next Scheduled Class Card */}
        {data?.nextSession && (
          <View style={styles.nextSessionSection}>
            <View style={styles.sectionHeaderRow}>
              <Clock size={16} color={Colors.warning} />
              <Text style={styles.sectionTitle}>Next Scheduled Class</Text>
            </View>

            <Card style={styles.nextSessionCard}>
              <View style={styles.nextSessionHeader}>
                <View>
                  <Text style={styles.nextSessionSubject}>{data.nextSession.subjectName}</Text>
                  <Text style={styles.nextSessionTeacher}>Trainer: {data.nextSession.teacherName}</Text>
                </View>
                <Badge label="Upcoming" variant="warning" size="sm" />
              </View>

              <View style={styles.timeTag}>
                <Calendar size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={styles.timeTagText}>
                  {formatTime(data.nextSession.startTime)} – {formatTime(data.nextSession.endTime)} (IST)
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Recent Classes & Homework */}
        <View style={styles.sectionHeaderRow}>
          <BookOpen size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Recent Classes & Topics</Text>
        </View>

        {!data?.recentClasses || data.recentClasses.length === 0 ? (
          <EmptyState
            title="No Attendance Records Yet"
            message="Your attended classes, trainer progress notes, and homework will appear here."
            icon={<BookOpen size={40} color={Colors.textMuted} />}
          />
        ) : (
          data.recentClasses.map((item) => (
            <Card key={item.id} style={styles.recentClassCard}>
              <View style={styles.recentClassHeader}>
                <View>
                  <Text style={styles.recentSubject}>{item.subjectName}</Text>
                  <Text style={styles.recentTeacher}>
                    {item.teacherName} • {formatDate(item.date)}
                  </Text>
                </View>
                <Badge label={item.studentAttendance} variant="success" size="sm" />
              </View>

              <View style={styles.topicBox}>
                <Text style={styles.topicLabel}>Topic Covered:</Text>
                <Text style={styles.topicContent}>{item.topicCovered}</Text>
              </View>

              {item.homework && (
                <View style={styles.homeworkBox}>
                  <Text style={styles.homeworkLabel}>Assigned Homework:</Text>
                  <Text style={styles.homeworkContent}>{item.homework}</Text>
                </View>
              )}

              {item.studentProgressNote && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Trainer Progress Feedback:</Text>
                  <Text style={styles.noteContent}>{item.studentProgressNote}</Text>
                </View>
              )}
            </Card>
          ))
        )}

        {/* View All Classes Shortcut */}
        <TouchableOpacity
          style={styles.viewAllShortcut}
          onPress={() => navigation.navigate("StudentClasses")}
          activeOpacity={0.8}
        >
          <Text style={styles.viewAllText}>View All Attended Classes</Text>
          <ChevronRight size={18} color={Colors.primary} />
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
  studentBadgeCard: {
    marginBottom: Spacing.lg,
  },
  studentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  studentName: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.text,
  },
  studentMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  packageCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primaryBorder,
    marginBottom: Spacing.lg,
  },
  packageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  packageTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  packageSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  remainingPill: {
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  remainingNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.primary,
  },
  remainingLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "uppercase",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    marginVertical: Spacing.xs,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  progressStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  progressStatText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  progressHighlight: {
    fontWeight: "800",
    color: Colors.text,
  },
  nextSessionSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginLeft: 6,
  },
  nextSessionCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  nextSessionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  nextSessionSubject: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  nextSessionTeacher: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: 4,
  },
  timeTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
  },
  recentClassCard: {
    marginBottom: Spacing.md,
  },
  recentClassHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  recentSubject: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  recentTeacher: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  topicBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: 4,
  },
  topicLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  topicContent: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "600",
  },
  homeworkBox: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: 4,
  },
  homeworkLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.warning,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  homeworkContent: {
    fontSize: 12,
    color: Colors.text,
  },
  noteBox: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: 4,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.info,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  noteContent: {
    fontSize: 12,
    color: Colors.text,
  },
  viewAllShortcut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    marginRight: 4,
  },
});
