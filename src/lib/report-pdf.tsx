/**
 * OnTrack PDF Template
 * Uses @react-pdf/renderer primitives — no HTML elements.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

/* ── Types ── */

export interface ReportData {
  clientName: string;
  clientColor: string;
  currency: string;
  dateRange: string;
  generatedAt: string;
  metrics: {
    spend: number;
    revenue: number;
    roas: number;
    mer: number;
    cpa: number;
    conversions: number;
    impressions: number;
    clicks: number;
  };
  selectedMetrics: string[];
  layout: string;
  topCampaigns?: { name: string; spend: number; roas: number; conversions: number }[];
}

/* ── Styles ── */

const PRIMARY = "#FF6A41";
const DARK = "#0A0A0F";
const MUTED = "#64748B";
const LIGHT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  page: {
    backgroundColor: LIGHT_BG,
    fontFamily: "Helvetica",
    paddingBottom: 60,
  },
  // Header
  header: {
    backgroundColor: DARK,
    paddingHorizontal: 32,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: WHITE,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  headerBrand: {
    color: WHITE,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerClient: {
    color: WHITE,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  headerMeta: {
    color: MUTED,
    fontSize: 8,
    marginTop: 2,
  },
  // Client bar
  clientBar: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clientDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  clientBarText: {
    fontSize: 9,
    color: MUTED,
  },
  clientBarBold: {
    fontSize: 9,
    color: DARK,
    fontFamily: "Helvetica-Bold",
  },
  // Body
  body: {
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  // KPI grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: WHITE,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: "30%",
    flex: 1,
  },
  kpiLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  kpiHighlight: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
  },
  // Table
  table: {
    backgroundColor: WHITE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tableCell: {
    fontSize: 8,
    color: DARK,
  },
  tableCellMuted: {
    fontSize: 8,
    color: MUTED,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: DARK,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    color: MUTED,
    fontSize: 7,
  },
  footerBrand: {
    color: PRIMARY,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  // Note
  note: {
    backgroundColor: "#FFF7ED",
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
    marginBottom: 20,
  },
  noteText: {
    fontSize: 8,
    color: "#92400E",
  },
});

/* ── Formatters ── */

function fmt(currency: string, value: number): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "AED ";
  return `${sym}${value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtROAS(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtNum(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

/* ── KPI Card ── */

function KpiBlock({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={highlight ? styles.kpiHighlight : styles.kpiValue}>{value}</Text>
    </View>
  );
}

/* ── Document ── */

export function ReportDocument({ data }: { data: ReportData }) {
  const { metrics, currency, selectedMetrics } = data;

  const allKpis: { key: string; label: string; value: string; highlight?: boolean }[] = [
    { key: "Spend", label: "Total Spend", value: fmt(currency, metrics.spend) },
    { key: "Revenue", label: "Revenue", value: fmt(currency, metrics.revenue), highlight: true },
    { key: "ROAS", label: "Platform ROAS", value: fmtROAS(metrics.roas), highlight: true },
    { key: "MER", label: "Blended MER", value: fmtROAS(metrics.mer) },
    { key: "CPA", label: "CPA", value: fmt(currency, metrics.cpa) },
    { key: "Conversions", label: "Conversions", value: fmtNum(metrics.conversions) },
    { key: "Impressions", label: "Impressions", value: fmtNum(metrics.impressions) },
    { key: "Clicks", label: "Clicks", value: fmtNum(metrics.clicks) },
  ];

  const visibleKpis = allKpis.filter(
    (k) => selectedMetrics.length === 0 || selectedMetrics.includes(k.key),
  );

  return (
    <Document
      title={`${data.clientName} — OnTrack`}
      author="OnSocial Agency"
      subject="Paid Media Performance Report"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandText}>OT</Text>
            </View>
            <Text style={styles.headerBrand}>OnTrack</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerClient}>{data.clientName}</Text>
            <Text style={styles.headerMeta}>
              {data.dateRange} · Generated {data.generatedAt}
            </Text>
          </View>
        </View>

        {/* Client bar */}
        <View style={styles.clientBar}>
          <View style={[styles.clientDot, { backgroundColor: data.clientColor }]} />
          <Text style={styles.clientBarBold}>{data.clientName}</Text>
          <Text style={styles.clientBarText}>Performance Report</Text>
          <Text style={styles.clientBarText}>·</Text>
          <Text style={styles.clientBarText}>{data.dateRange}</Text>
          <Text style={styles.clientBarText}>·</Text>
          <Text style={styles.clientBarText}>
            {data.layout.charAt(0).toUpperCase() + data.layout.slice(1)}
          </Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* KPIs */}
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.kpiGrid}>
            {visibleKpis.map((kpi) => (
              <KpiBlock
                key={kpi.key}
                label={kpi.label}
                value={kpi.value}
                highlight={kpi.highlight}
              />
            ))}
          </View>

          {/* Campaign table (if detailed layout) */}
          {data.topCampaigns && data.topCampaigns.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Top Campaigns</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Campaign</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Spend</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>ROAS</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Conv.</Text>
                </View>
                {data.topCampaigns.map((c, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tableRow,
                      i === data.topCampaigns!.length - 1 ? { borderBottomWidth: 0 } : {},
                    ]}
                  >
                    <Text style={[styles.tableCell, { flex: 3 }]}>
                      {c.name.length > 40 ? c.name.slice(0, 40) + "…" : c.name}
                    </Text>
                    <Text style={[styles.tableCellMuted, { flex: 1, textAlign: "right" }]}>
                      {fmt(currency, c.spend)}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>
                      {fmtROAS(c.roas)}
                    </Text>
                    <Text style={[styles.tableCellMuted, { flex: 1, textAlign: "right" }]}>
                      {c.conversions}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Disclaimer note */}
          <View style={styles.note}>
            <Text style={styles.noteText}>
              This report was generated by OnSocial using OnTrack. Data reflects paid media performance
              for the selected period. Platform ROAS may differ from blended MER due to attribution
              model and organic revenue differences. Confidential — not for distribution.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Confidential · {data.clientName} · {data.generatedAt}
          </Text>
          <Text style={styles.footerBrand}>Powered by OnTrack · OnSocial Agency</Text>
        </View>
      </Page>
    </Document>
  );
}
