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
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { EmptyState } from "../../components/EmptyState";
import { DollarSign, Clock, UserCheck } from "lucide-react-native";

export function AdminPayoutsScreen() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayouts = async () => {
    try {
      const res = await apiRequest("/api/mobile/admin/payouts");
      if (res.success) {
        setPayouts(res.payouts);
        setStats(res.stats);
      }
    } catch (err: any) {
      console.log("Payouts fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);
  useReloadOnReturn(fetchPayouts);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayouts();
  };

  const renderPayoutItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.trainerName}>{item.teacherName}</Text>
          <Text style={styles.rateText}>Base Rate: ₹{item.hourlyRate}/hr</Text>
        </View>
        <Text style={styles.payoutAmount}>₹{item.estimatedPayout?.toLocaleString()}</Text>
      </View>

      <View style={styles.hoursRow}>
        <View style={styles.hoursBlock}>
          <Text style={styles.hoursLabel}>Completed Hours</Text>
          <Text style={styles.hoursVal}>{item.completedHours} hrs</Text>
        </View>
        <View style={styles.hoursBlock}>
          <Text style={styles.hoursLabel}>Classes Taught</Text>
          <Text style={styles.hoursVal}>{item.completedClassesCount} classes</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Trainer Payouts" subtitle="Monthly earnings & calculated payout runs" />

      {/* Stats Counter */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>₹{stats.totalEstimatedPayout?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Payout</Text>
          </View>
          <View style={[styles.statPill, { borderColor: theme.colors.brandCyan }]}>
            <Text style={[styles.statNum, { color: theme.colors.brandCyan }]}>{stats.totalTeachingHours} hrs</Text>
            <Text style={styles.statLabel}>Total Teaching Hours</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.activeTrainersCount}</Text>
            <Text style={styles.statLabel}>Trainers</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(item) => item.teacherId}
          renderItem={renderPayoutItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
          ListEmptyComponent={
            <EmptyState
              title="No Payout Data"
              message="Trainer session payouts will be computed here."
              icon={<DollarSign size={40} color={theme.colors.textMuted} />}
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
  trainerName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  rateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  payoutAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.brandLime,
  },
  hoursRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  hoursBlock: {
    flex: 1,
  },
  hoursLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  hoursVal: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 2,
  },
});
