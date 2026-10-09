import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { BarChart3, Users, BookOpen, Receipt, DollarSign } from "lucide-react-native";

export function AdminReportsScreen() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await apiRequest("/api/mobile/admin/reports");
      if (res.success) {
        setMetrics(res.metrics);
      }
    } catch (err: any) {
      console.log("Reports fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Reports & Analytics" subtitle="Center-wide financial & academic metrics" />

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
        >
          {/* Revenue Card */}
          <View style={styles.metricCard}>
            <Text style={styles.cardSectionTitle}>FINANCIAL PERFORMANCE</Text>
            <View style={styles.metricGrid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Total Invoiced</Text>
                <Text style={styles.gridValue}>₹{metrics?.totalInvoicedRevenue?.toLocaleString()}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Total Collected</Text>
                <Text style={[styles.gridValue, { color: theme.colors.success }]}>
                  ₹{metrics?.totalCollectedRevenue?.toLocaleString()}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Pending Dues</Text>
                <Text style={[styles.gridValue, { color: theme.colors.danger }]}>
                  ₹{metrics?.totalPendingDues?.toLocaleString()}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Unpaid Invoices</Text>
                <Text style={[styles.gridValue, { color: theme.colors.warning }]}>
                  {metrics?.unpaidInvoicesCount}
                </Text>
              </View>
            </View>
          </View>

          {/* Academic Operations Card */}
          <View style={styles.metricCard}>
            <Text style={styles.cardSectionTitle}>ACADEMICS & TRAINING</Text>
            <View style={styles.metricGrid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Active Students</Text>
                <Text style={styles.gridValue}>{metrics?.activeStudents}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Active Trainers</Text>
                <Text style={styles.gridValue}>{metrics?.totalTrainers}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Classes Completed</Text>
                <Text style={[styles.gridValue, { color: theme.colors.brandCyan }]}>
                  {metrics?.totalCompletedClasses}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Admissions Received</Text>
                <Text style={[styles.gridValue, { color: theme.colors.brandLime }]}>
                  {metrics?.totalAdmissionsReceived}
                </Text>
              </View>
            </View>
          </View>
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
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  metricCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.brandCyan,
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: theme.spacing.lg,
  },
  gridItem: {
    width: "50%",
  },
  gridLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 2,
  },
});
