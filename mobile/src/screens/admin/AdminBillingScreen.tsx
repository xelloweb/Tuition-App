import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { useReloadOnReturn } from "../../config/useReloadOnReturn";
import { formatIstDate } from "../../config/ist";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react-native";

export function AdminBillingScreen() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");

  const fetchBilling = async () => {
    try {
      const res = await apiRequest(`/api/mobile/admin/billing?status=${filter}`);
      if (res.success) {
        setInvoices(res.invoices);
        setStats(res.stats);
      }
    } catch (err: any) {
      console.log("Billing fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [filter]);
  useReloadOnReturn(fetchBilling);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBilling();
  };

  const handleMarkPaid = (invoiceId: string, invoiceNumber: string) => {
    Alert.alert(
      "Confirm Payment",
      `Mark invoice ${invoiceNumber} as fully paid?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: async () => {
            try {
              const res = await apiRequest("/api/mobile/admin/billing", {
                method: "POST",
                body: JSON.stringify({ invoiceId, action: "MARK_PAID" }),
              });
              if (res.success) {
                Alert.alert("Success", "Invoice marked as paid!");
                fetchBilling();
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Could not update invoice");
            }
          },
        },
      ]
    );
  };

  const renderInvoice = ({ item }: { item: any }) => {
    const isPaid = item.status === "PAID";
    const isUnpaid = item.status === "UNPAID" || item.status === "OVERDUE";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
            <Text style={styles.studentName}>{item.studentName}</Text>
          </View>
          <Badge
            label={item.status}
            variant={isPaid ? "success" : isUnpaid ? "danger" : "warning"}
          />
        </View>

        <View style={styles.amountRow}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>₹{item.totalAmount?.toLocaleString()}</Text>
          </View>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Balance Due</Text>
            <Text style={[styles.amountValue, { color: isUnpaid ? theme.colors.danger : theme.colors.success }]}>
              ₹{item.balanceDue?.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.dateText}>
            Due: {formatIstDate(item.dueDate)}
          </Text>
          {isUnpaid && (
            <TouchableOpacity
              style={styles.markPaidBtn}
              onPress={() => handleMarkPaid(item.id, item.invoiceNumber)}
              activeOpacity={0.7}
            >
              <CheckCircle2 size={14} color="#000" />
              <Text style={styles.markPaidText}>Mark Paid</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Invoices & Billing" subtitle="Manage fee collections & dues" />

      {/* Stats Summary Bar */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL INVOICED</Text>
            <Text style={styles.statVal}>₹{stats.totalInvoiced?.toLocaleString()}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>COLLECTED</Text>
            <Text style={[styles.statVal, { color: theme.colors.success }]}>
              ₹{stats.totalPaid?.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>BALANCE DUE</Text>
            <Text style={[styles.statVal, { color: theme.colors.danger }]}>
              ₹{stats.totalDue?.toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabFilterRow}>
        {(["ALL", "UNPAID", "PAID"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === "ALL" ? "All Invoices" : tab === "UNPAID" ? "Unpaid & Overdue" : "Paid"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
          ListEmptyComponent={
            <EmptyState
              title="No Invoices Found"
              message="No invoices match the selected filter."
              icon={<Receipt size={40} color={theme.colors.textMuted} />}
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
  statsBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  statVal: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 2,
  },
  tabFilterRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: "rgba(64, 174, 227, 0.15)",
    borderColor: theme.colors.brandCyan,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  filterTabTextActive: {
    color: theme.colors.brandCyan,
    fontWeight: "700",
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
  cardHeaderLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.brandCyan,
    letterSpacing: 0.5,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  amountBlock: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  amountValue: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.brandLime,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  markPaidText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
});
