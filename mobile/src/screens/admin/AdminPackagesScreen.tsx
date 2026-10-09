import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { useReloadOnReturn } from "../../config/useReloadOnReturn";
import { formatIstDate } from "../../config/ist";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Layers, Calendar, CheckCircle2 } from "lucide-react-native";

export function AdminPackagesScreen() {
  const [packages, setPackages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPackages = async () => {
    try {
      const res = await apiRequest("/api/mobile/admin/packages");
      if (res.success) {
        setPackages(res.packages);
        setStats(res.stats);
      }
    } catch (err: any) {
      console.log("Packages fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);
  useReloadOnReturn(fetchPackages);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPackages();
  };

  const renderPackage = ({ item }: { item: any }) => {
    const isActive = item.status === "ACTIVE";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.packageName}>{item.name}</Text>
            <Text style={styles.studentInfo}>{item.studentName} ({item.studentCode})</Text>
          </View>
          <Badge label={item.status} variant={isActive ? "success" : "secondary"} />
        </View>

        <View style={styles.creditStatsRow}>
          <View style={styles.creditBlock}>
            <Text style={styles.creditLabel}>Total Credits</Text>
            <Text style={styles.creditValue}>{item.totalCredits} Classes</Text>
          </View>
          <View style={styles.creditBlock}>
            <Text style={styles.creditLabel}>Package Fee</Text>
            <Text style={[styles.creditValue, { color: theme.colors.brandLime }]}>
              ₹{item.price?.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Subject Allocations */}
        {item.allocations && item.allocations.length > 0 && (
          <View style={styles.allocationsBox}>
            <Text style={styles.allocationsTitle}>Subject Credits Remaining:</Text>
            {item.allocations.map((a: any) => (
              <View key={a.id} style={styles.allocationRow}>
                <Text style={styles.allocSubject}>{a.subjectName}</Text>
                <Text style={styles.allocCredits}>
                  {a.allocatedCredits} classes allocated
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.expiryText}>
            {item.expiryDate ? `Expires: ${formatIstDate(item.expiryDate)}` : "No Expiry Date"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Packages & Credits" subtitle="Student credit balances & tracking" />

      {/* Stats Counter */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.totalPackages}</Text>
            <Text style={styles.statLabel}>Total Packages</Text>
          </View>
          <View style={[styles.statPill, { borderColor: theme.colors.success }]}>
            <Text style={[styles.statNum, { color: theme.colors.success }]}>{stats.activePackages}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statPill, { borderColor: theme.colors.brandCyan }]}>
            <Text style={[styles.statNum, { color: theme.colors.brandCyan }]}>{stats.totalCredits}</Text>
            <Text style={styles.statLabel}>Total Credits</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={packages}
          keyExtractor={(item) => item.id}
          renderItem={renderPackage}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
          ListEmptyComponent={
            <EmptyState
              title="No Packages Found"
              message="Student packages and allocated class credits will appear here."
              icon={<Layers size={40} color={theme.colors.textMuted} />}
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    gap: 8,
  },
  statPill: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statNum: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  listContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  packageName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  studentInfo: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  creditStatsRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  creditBlock: {
    flex: 1,
  },
  creditLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  creditValue: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 2,
  },
  allocationsBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  allocationsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  allocationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  allocSubject: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: "600",
  },
  allocCredits: {
    fontSize: 12,
    color: theme.colors.brandCyan,
    fontWeight: "700",
  },
  footerRow: {
    marginTop: theme.spacing.md,
  },
  expiryText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
