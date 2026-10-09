import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { EmptyState } from "../../components/EmptyState";
import { Calendar, Clock, User, BookOpen } from "lucide-react-native";

export function AdminTimetableScreen() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(1); // Default to Monday (1)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimetable = async () => {
    try {
      const res = await apiRequest("/api/mobile/admin/timetable");
      if (res.success) {
        setSchedule(res.schedule);
      }
    } catch (err: any) {
      console.log("Timetable fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTimetable();
  };

  const currentDayData = schedule.find((d) => d.weekday === activeDayIndex) || { slots: [] };
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Weekly Timetable" subtitle="Class schedules in India Standard Time" />

      {/* Day Selector Pill Tabs */}
      <View style={styles.daySelectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {dayNamesShort.map((day, idx) => {
            const isSelected = activeDayIndex === idx;
            const dayCount = schedule.find((d) => d.weekday === idx)?.count || 0;

            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayTab, isSelected && styles.dayTabActive]}
                onPress={() => setActiveDayIndex(idx)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{day}</Text>
                <View style={[styles.dayBadge, isSelected && styles.dayBadgeActive]}>
                  <Text style={[styles.dayBadgeText, isSelected && styles.dayBadgeTextActive]}>{dayCount}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
        >
          {currentDayData.slots.length === 0 ? (
            <EmptyState
              title={`No Classes on ${dayNamesShort[activeDayIndex]}`}
              message="No timetable slots scheduled for this day."
              icon={<Calendar size={40} color={theme.colors.textMuted} />}
            />
          ) : (
            currentDayData.slots.map((slot: any) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.timeBadge}>
                  <Clock size={14} color={theme.colors.brandCyan} />
                  <Text style={styles.timeText}>{slot.startTime} - {slot.endTime}</Text>
                </View>

                <View style={styles.slotBody}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{slot.studentName}</Text>
                    <Text style={styles.studentGrade}>{slot.studentGrade || "Grade N/A"} • {slot.studentCode}</Text>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailTag}>
                      <BookOpen size={12} color={theme.colors.brandLime} />
                      <Text style={[styles.detailText, { color: theme.colors.brandLime }]}>
                        {slot.subjectName}
                      </Text>
                    </View>

                    <View style={styles.detailTag}>
                      <User size={12} color={theme.colors.textSecondary} />
                      <Text style={styles.detailText}>{slot.teacherName}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  daySelectorRow: {
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayScroll: {
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 54,
  },
  dayTabActive: {
    backgroundColor: "rgba(64, 174, 227, 0.15)",
    borderColor: theme.colors.brandCyan,
  },
  dayName: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  dayNameActive: {
    color: theme.colors.brandCyan,
    fontWeight: "700",
  },
  dayBadge: {
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dayBadgeActive: {
    backgroundColor: theme.colors.brandCyan,
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  dayBadgeTextActive: {
    color: "#000",
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  slotCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.brandCyan,
  },
  slotBody: {
    padding: theme.spacing.md,
  },
  studentInfo: {
    marginBottom: theme.spacing.sm,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },
  studentGrade: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
  },
  detailTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
});
