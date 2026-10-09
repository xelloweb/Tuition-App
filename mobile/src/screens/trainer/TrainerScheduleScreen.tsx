import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../config/api";
import { Calendar, Clock, GraduationCap } from "lucide-react-native";

interface ScheduleSlot {
  id: string;
  weekday: number;
  start: string;
  end: string;
  studentName: string;
  studentCode: string;
  grade?: string;
  subjectName: string;
  subjectColor?: string;
}

export function TrainerScheduleScreen() {
  const { trainer, token } = useAuth();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay()); // Default to today (0 = Sun, 1 = Mon...)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const days = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  const fetchSchedule = async () => {
    if (!trainer?.teacherId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; slots: ScheduleSlot[] }>(
        `/api/mobile/trainer/timetable?teacherId=${trainer.teacherId}`,
        { token }
      );
      if (res.success) {
        setSlots(res.slots);
        setLoadError(null);
      }
    } catch (err) {
      // Never show a sample timetable in place of the trainer's real one.
      setSlots([]);
      setLoadError(err instanceof Error ? err.message : "Could not load your timetable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [trainer?.teacherId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedule();
  };

  const daySlots = slots.filter((s) => s.weekday === selectedDay);

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      <Header
        title="Weekly Schedule"
        subtitle="Your recurring timetable slots across all subjects"
      />

      {/* Day Selector Pills */}
      <View style={styles.daysContainer}>
        {days.map((d) => {
          const isSelected = selectedDay === d.value;
          const count = slots.filter((s) => s.weekday === d.value).length;
          return (
            <TouchableOpacity
              key={d.value}
              style={[styles.dayPill, isSelected && styles.dayPillSelected]}
              onPress={() => setSelectedDay(d.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                {d.label}
              </Text>
              {count > 0 && (
                <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                  <Text style={[styles.countText, isSelected && styles.countTextSelected]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loadError ? (
          <EmptyState
            title="Could not load your timetable"
            message={loadError}
            icon={<Calendar size={40} color={Colors.textMuted} />}
            actionLabel="Try again"
            onAction={onRefresh}
          />
        ) : daySlots.length === 0 ? (
          <EmptyState
            title={`No Classes on ${days.find((d) => d.value === selectedDay)?.label}`}
            message="You have no scheduled tuition slots for this day."
            icon={<Calendar size={40} color={Colors.textMuted} />}
          />
        ) : (
          daySlots.map((slot) => (
            <Card key={slot.id} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.studentName}>{slot.studentName}</Text>
                    <Text style={styles.studentCode}>({slot.studentCode})</Text>
                  </View>
                  {slot.grade && <Text style={styles.gradeText}>{slot.grade}</Text>}
                </View>

                <Badge label={slot.subjectName} color={slot.subjectColor || Colors.primary} />
              </View>

              <View style={styles.timeRow}>
                <Clock size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.timeText}>
                  {formatDisplayTime(slot.start)} – {formatDisplayTime(slot.end)} (IST)
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  daysContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  dayPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginHorizontal: 2,
  },
  dayPillSelected: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  dayLabelSelected: {
    color: Colors.primary,
  },
  countBadge: {
    marginTop: 3,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  countBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  countText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
  },
  countTextSelected: {
    color: "#000",
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  slotCard: {
    marginBottom: Spacing.md,
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  nameRow: {
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
  gradeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
});
