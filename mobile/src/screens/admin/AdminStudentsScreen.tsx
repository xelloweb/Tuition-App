import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Search, Phone, MessageSquare, BookOpen, Users } from "lucide-react-native";

export function AdminStudentsScreen() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiRequest(`/api/mobile/admin/students${query}`);
      setStudents(res.students || []);
    } catch (err) {
      console.error("Failed to load students", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openWhatsApp = (phone: string, studentName: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const msg = `Hello from Xello Tuition regarding student ${studentName}.`;
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="All Students" subtitle={`${students.length} Active Students`} />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student name or grade..."
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.studentName}>{item.name}</Text>
                  <Text style={styles.studentMeta}>
                    {item.grade} • {item.board} • {item.country}
                  </Text>
                </View>
                <Badge label={item.studentCode} color={theme.colors.teal} />
              </View>

              {/* Package Info */}
              <View style={styles.packageRow}>
                <BookOpen size={14} color={theme.colors.textMuted} />
                <Text style={styles.packageText}>Package: {item.activePackage}</Text>
              </View>

              {/* Enrolled Subjects */}
              <View style={styles.subjectsContainer}>
                {item.enrolledSubjects?.map((sub: any, idx: number) => (
                  <View key={idx} style={styles.subjectChip}>
                    <Text style={styles.subjectChipText}>
                      {sub.subjectName} ({sub.teacherName})
                    </Text>
                  </View>
                ))}
              </View>

              {/* Guardian Actions */}
              <View style={styles.footerRow}>
                <Text style={styles.guardianText}>Guardian: {item.guardianName}</Text>
                {item.whatsappNumber ? (
                  <TouchableOpacity
                    style={styles.waButton}
                    onPress={() => openWhatsApp(item.whatsappNumber, item.name)}
                  >
                    <MessageSquare size={14} color="#fff" />
                    <Text style={styles.waButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No students found"
              description="Try adjusting your search criteria"
              icon={<Users size={48} color={theme.colors.textMuted} />}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 46,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  card: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  studentName: {
    fontSize: theme.fontSize.base,
    fontWeight: "700",
    color: theme.colors.text,
  },
  studentMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  packageText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  subjectsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  subjectChip: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  subjectChipText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  guardianText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  waButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16a34a",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  waButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
