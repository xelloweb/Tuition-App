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
import { useReloadOnReturn } from "../../config/useReloadOnReturn";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Search, Phone, Mail, GraduationCap } from "lucide-react-native";

export function AdminTeachersScreen() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiRequest(`/api/mobile/admin/teachers${query}`);
      setTeachers(res.teachers || []);
    } catch (err) {
      console.error("Failed to load teachers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTeachers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useReloadOnReturn(fetchTeachers);

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="All Trainers" subtitle={`${teachers.length} Active Academic Trainers`} />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by trainer name or subject..."
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
          data={teachers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.trainerName}>{item.name}</Text>
                  <Text style={styles.trainerMeta}>{item.email}</Text>
                </View>
                <Badge label={`${item.activeStudentsCount} Students`} color={theme.colors.teal} />
              </View>

              {/* Subjects & Grades */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Subjects:</Text>
                <Text style={styles.infoValue}>{item.subjects}</Text>
              </View>
              {item.grades ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Grades:</Text>
                  <Text style={styles.infoValue}>{item.grades}</Text>
                </View>
              ) : null}

              {/* Contact actions */}
              <View style={styles.footerRow}>
                <Text style={styles.phoneText}>{item.phone}</Text>
                <TouchableOpacity style={styles.callButton} onPress={() => callPhone(item.phone)}>
                  <Phone size={14} color="#fff" />
                  <Text style={styles.callButtonText}>Call Trainer</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No trainers found"
              description="Try adjusting your search criteria"
              icon={<GraduationCap size={48} color={theme.colors.textMuted} />}
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
  trainerName: {
    fontSize: theme.fontSize.base,
    fontWeight: "700",
    color: theme.colors.text,
  },
  trainerMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  infoLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  infoValue: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    flex: 1,
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
  phoneText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  callButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
