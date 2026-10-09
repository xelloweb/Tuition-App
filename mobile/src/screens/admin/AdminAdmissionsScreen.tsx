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
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Inbox, Share2, Phone, Calendar, UserPlus } from "lucide-react-native";

export function AdminAdmissionsScreen() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [applyUrl, setApplyUrl] = useState("https://xellotuition.com/admission/apply");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdmissions = async () => {
    try {
      const res = await apiRequest("/api/mobile/admin/admissions");
      if (res.success) {
        setSubmissions(res.submissions);
        setStats(res.stats);
        if (res.applyUrl) setApplyUrl(res.applyUrl);
      }
    } catch (err: any) {
      console.log("Admissions fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdmissions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdmissions();
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Xello Tuition Student Admission Form: ${applyUrl}`,
        url: applyUrl,
      });
    } catch (err) {
      console.log("Share error", err);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isNew = item.status === "NEW";
    const isConverted = item.status === "CONVERTED";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.studentName}>{item.studentName}</Text>
            <Text style={styles.refCode}>Ref: {item.reference}</Text>
          </View>
          <Badge
            label={item.status}
            variant={isNew ? "warning" : isConverted ? "success" : "secondary"}
          />
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Grade & Board</Text>
            <Text style={styles.detailVal}>{item.grade} • {item.board}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Subjects Requested</Text>
            <Text style={[styles.detailVal, { color: theme.colors.brandLime }]}>
              {item.subjectNames || "All Subjects"}
            </Text>
          </View>
        </View>

        <View style={styles.contactRow}>
          <View style={styles.contactLeft}>
            <Phone size={14} color={theme.colors.textMuted} />
            <Text style={styles.contactText}>{item.guardianName} ({item.whatsappNumber})</Text>
          </View>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Admissions & Intake" subtitle="Parent applications & public link" />

      {/* Shareable Link Banner */}
      <View style={styles.linkBanner}>
        <View style={styles.linkInfo}>
          <Text style={styles.linkTitle}>PUBLIC ADMISSION FORM LINK</Text>
          <Text style={styles.linkSub} numberOfLines={1}>{applyUrl}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareLink} activeOpacity={0.7}>
          <Share2 size={16} color="#000" />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Counter */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.totalSubmissions}</Text>
            <Text style={styles.statLabel}>Total Received</Text>
          </View>
          <View style={[styles.statPill, { borderColor: theme.colors.warning }]}>
            <Text style={[styles.statNum, { color: theme.colors.warning }]}>{stats.newSubmissions}</Text>
            <Text style={styles.statLabel}>Pending Review</Text>
          </View>
          <View style={[styles.statPill, { borderColor: theme.colors.success }]}>
            <Text style={[styles.statNum, { color: theme.colors.success }]}>{stats.convertedSubmissions}</Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
          ListEmptyComponent={
            <EmptyState
              title="No Admissions Yet"
              message="New parent admission submissions will appear here."
              icon={<Inbox size={40} color={theme.colors.textMuted} />}
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
  linkBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  linkInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  linkTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.brandCyan,
    letterSpacing: 0.5,
  },
  linkSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.brandLime,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 6,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
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
    fontSize: 10,
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
  studentName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  refCode: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  detailsGrid: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    gap: 6,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
});
