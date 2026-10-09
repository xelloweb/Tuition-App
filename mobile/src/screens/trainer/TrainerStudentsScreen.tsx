import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../config/api";
import { Search, Phone, MessageSquare, ChevronRight, BookOpen, Layers } from "lucide-react-native";

interface StudentItem {
  id: string;
  name: string;
  studentCode: string;
  grade?: string;
  board?: string;
  whatsappNumber?: string;
  assignedSubjects: Array<{
    enrolmentId: string;
    subjectId: string;
    subjectName: string;
    subjectColor?: string;
    allocatedCredits: number;
    consumedCredits: number;
    remainingCredits: number;
  }>;
}

export function TrainerStudentsScreen({ navigation }: any) {
  const { trainer, token } = useAuth();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStudents = async () => {
    if (!trainer?.teacherId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; students: StudentItem[] }>(
        `/api/mobile/trainer/students?teacherId=${trainer.teacherId}`,
        { token }
      );
      if (res.success) {
        setStudents(res.students);
        setLoadError(null);
      }
    } catch (err) {
      // Never show sample students in place of the trainer's real list.
      setStudents([]);
      setLoadError(err instanceof Error ? err.message : "Could not load your students.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [trainer?.teacherId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      s.assignedSubjects.some((sub) => sub.subjectName.toLowerCase().includes(q))
    );
  });

  const handleWhatsApp = (phone?: string) => {
    if (!phone) {
      Alert.alert("No Contact", "No phone number recorded for this student.");
      return;
    }
    const cleanPhone = phone.replace(/[^\d]/g, "");
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`).catch(() => {
      Alert.alert("WhatsApp Unavailable", "Could not open WhatsApp on this device.");
    });
  };

  const renderStudentItem = ({ item }: { item: StudentItem }) => (
    <Card style={styles.studentCard}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate("TrainerStudentDetail", { student: item })}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentCode}>({item.studentCode})</Text>
            </View>
            <Text style={styles.gradeText}>
              {item.grade ? `${item.grade} • ` : ""}
              {item.board || "CBSE"}
            </Text>
          </View>

          <ChevronRight size={20} color={Colors.textSecondary} />
        </View>

        {/* Assigned Subjects & Credits */}
        <View style={styles.subjectsContainer}>
          {item.assignedSubjects.map((sub) => (
            <View key={sub.enrolmentId} style={styles.subjectRow}>
              <Badge label={sub.subjectName} color={sub.subjectColor || Colors.primary} />
              
              <View style={styles.creditPill}>
                <Layers size={12} color={Colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.creditText}>
                  <Text style={styles.creditHighlight}>{sub.remainingCredits}</Text> / {sub.allocatedCredits} classes left
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* WhatsApp & Contact Footer */}
        {item.whatsappNumber && (
          <View style={styles.cardFooter}>
            <Text style={styles.contactText}>WhatsApp: {item.whatsappNumber}</Text>
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={() => handleWhatsApp(item.whatsappNumber)}
              activeOpacity={0.7}
            >
              <MessageSquare size={13} color="#25D366" />
              <Text style={styles.whatsappButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="My Students"
        subtitle="Students assigned to you for specific subjects"
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student name, ID, or subject..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderStudentItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          loadError ? (
            <EmptyState
              title="Could not load your students"
              message={loadError}
              icon={<BookOpen size={40} color={Colors.textMuted} />}
              actionLabel="Try again"
              onAction={onRefresh}
            />
          ) : (
          <EmptyState
            title="No Assigned Students Found"
            message={
              searchQuery
                ? "No students match your search query."
                : "You currently have no students assigned to your subjects."
            }
            icon={<BookOpen size={40} color={Colors.textMuted} />}
          />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    paddingVertical: Spacing.sm + 2,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  studentCard: {
    marginBottom: Spacing.md,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameContainer: {
    flex: 1,
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
  subjectsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  creditPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  creditText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  creditHighlight: {
    color: Colors.primary,
    fontWeight: "800",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  contactText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  whatsappButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37, 211, 102, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.3)",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  whatsappButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#25D366",
    marginLeft: 4,
  },
});
