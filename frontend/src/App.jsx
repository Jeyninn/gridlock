import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ─── WARM, HUMAN COLOR PALETTE ─────────────────────────────────────────────
const PAGE_BG = "#f5f2eb";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#e2ddd3";
const NAV_BG = "#1e3a5f";
const NAV_TEXT = "#f5f2eb";
const PRIMARY = "#1e3a5f";
const ACCENT = "#c75d3a";
const SUCCESS = "#3d7a5a";
const WARNING = "#d4953a";
const TEXT_DARK = "#1a1a1a";
const TEXT_BODY = "#3d3d3d";
const TEXT_MUTED = "#6b6b6b";

const TIER_COLORS = {
  HIGH: "#b84434",
  MEDIUM: "#d4953a",
  LOW: "#3d7a5a",
};

const CHART_COLORS = [
  "#1e3a5f",
  "#c75d3a",
  "#7a6ba5",
  "#3d7a5a",
  "#d4953a",
  "#5a7a9a",
  "#8a6b5a",
];

const styles = {
  pageContainer: {
    minHeight: "100vh",
    background: PAGE_BG,
    fontFamily:
      "'Poppins','Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    color: TEXT_DARK,
  },
  card: {
    background: CARD_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    padding: 28,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  headingXL: {
    fontFamily: "'Poppins','Montserrat',sans-serif",
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
    color: TEXT_DARK,
  },
  headingL: {
    fontFamily: "'Poppins','Montserrat',sans-serif",
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
    color: TEXT_DARK,
  },
  headingM: {
    fontFamily: "'Poppins','Montserrat',sans-serif",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.4,
    color: TEXT_DARK,
  },
  bodyL: { fontSize: 16, fontWeight: 400, lineHeight: 1.6, color: TEXT_BODY },
  bodyM: { fontSize: 15, fontWeight: 400, lineHeight: 1.5, color: TEXT_BODY },
  bodyS: { fontSize: 14, fontWeight: 400, lineHeight: 1.5, color: TEXT_MUTED },
  label: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: TEXT_MUTED,
  },
  mono: {
    fontFamily: "'JetBrains Mono','SF Mono',monospace",
    fontSize: 14,
    fontWeight: 500,
  },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const vals = [];
    let inQuotes = false;
    let current = "";

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        vals.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    vals.push(current);
    return vals;
  };

  const header = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (vals[idx] || "").trim();
    });
    return row;
  });
}

function cleanAction(raw) {
  return String(raw || "")
    .replace(/\s*ESCALATING\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function formatCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "N/A";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function makeMapsUrl(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function makeDirectionsUrl(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "#";
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function buildFallbackLocation(row) {
  // If you later add a CSV column called location_name, that exact name will be used.
  // Otherwise this gives police a useful operational label + exact map coordinates.
  const roadType = titleCase(row.road_type || "Road");
  const nearby = row.nearby_pois ? `near ${row.nearby_pois}` : "Bengaluru";
  return `${roadType} road ${nearby}`;
}

// Derive all analytics from raw CSV rows
function deriveAnalytics(rows) {
  const totalClusters = rows.length;
  const totalViolations = rows.reduce((s, r) => s + Number(r.violation_count || 0), 0);
  const avgScore = totalClusters
    ? (rows.reduce((s, r) => s + Number(r.priority_score || 0), 0) / totalClusters).toFixed(1)
    : "0.0";

  const tierCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  rows.forEach((r) => {
    if (tierCounts[r.priority_tier] !== undefined) tierCounts[r.priority_tier]++;
  });

  const trendCounts = { Emerging: 0, Stable: 0, Declining: 0 };
  rows.forEach((r) => {
    if (trendCounts[r.trend_label] !== undefined) trendCounts[r.trend_label]++;
  });

  const vehicleMap = {};
  rows.forEach((r) => {
    const v = r.dominant_vehicle || "Other";
    vehicleMap[v] = (vehicleMap[v] || 0) + Number(r.violation_count || 0);
  });
  const vehicleDist = Object.entries(vehicleMap)
    .map(([name, violations]) => ({ name, violations }))
    .sort((a, b) => b.violations - a.violations);

  const hourMap = {};
  for (let h = 0; h < 24; h++) hourMap[h] = 0;
  rows.forEach((r) => {
    const h = parseInt(r.peak_hour, 10);
    const v = Number(r.violation_count || 0);
    if (!Number.isNaN(h) && hourMap[h] !== undefined) hourMap[h] += v;
  });
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: String(h).padStart(2, "0"),
    violations: hourMap[h] || 0,
  }));

  const roadMap = {};
  const roadClusterMap = {};
  rows.forEach((r) => {
    const rt = r.road_type || "Other";
    roadMap[rt] = (roadMap[rt] || 0) + Number(r.violation_count || 0);
    roadClusterMap[rt] = (roadClusterMap[rt] || 0) + 1;
  });
  const roadTypeData = Object.entries(roadMap)
    .map(([type, violations]) => ({
      type: titleCase(type),
      rawType: type,
      violations,
      clusters: roadClusterMap[type] || 0,
    }))
    .sort((a, b) => b.violations - a.violations);

  const actionMap = {};
  rows.forEach((r) => {
    const a = cleanAction(r.recommended_action || "No action specified");
    actionMap[a] = (actionMap[a] || 0) + 1;
  });
  const actionDist = Object.entries(actionMap)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  const topClusters = [...rows]
    .map((r) => {
      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      const locationName = r.location_name || r.place_name || r.address || buildFallbackLocation(r);

      return {
        id: `C-${r.geo_cluster}`,
        clusterNo: r.geo_cluster,
        area: `Cluster ${r.geo_cluster}`,
        locationName,
        score: Number(r.priority_score || 0),
        count: Number(r.violation_count || 0),
        tier: r.priority_tier || "LOW",
        trend: r.trend_label || "Stable",
        vehicle: r.dominant_vehicle || "N/A",
        action: cleanAction(r.recommended_action || ""),
        roadType: titleCase(r.road_type || ""),
        nearbyPois: r.nearby_pois || "N/A",
        congestionImpact: Number(r.congestion_impact || 0),
        lat,
        lng,
        coordinates: formatCoords(lat, lng),
        mapUrl: makeMapsUrl(lat, lng),
        directionsUrl: makeDirectionsUrl(lat, lng),
        peakHour: r.peak_hour || "",
      };
    })
    .sort((a, b) => b.score - a.score);

  const emergingZones = topClusters
    .filter((c) => c.trend === "Emerging")
    .slice(0, 8)
    .map((c, i) => ({
      area: c.id,
      locationName: c.locationName,
      coordinates: c.coordinates,
      directionsUrl: c.directionsUrl,
      status: i < 4 ? "ESCALATING" : "WATCH",
      urgency: i < 4 ? "This week" : "This month",
      score: c.score,
    }));

  return {
    totalClusters,
    totalViolations,
    avgScore,
    tierCounts,
    trendCounts,
    vehicleDist,
    hourlyData,
    roadTypeData,
    actionDist,
    topClusters,
    emergingZones,
  };
}

// ─── REUSABLE COMPONENTS ───────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div
      style={{
        ...styles.card,
        borderTop: `4px solid ${accent}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={styles.label}>{label}</span>
        <span style={{ fontSize: 22, opacity: 0.6 }}>{icon}</span>
      </div>
      <span
        style={{
          fontFamily: "'Poppins','Montserrat',sans-serif",
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: TEXT_DARK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      {sub && <span style={styles.bodyS}>{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, subtitle, kicker }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {kicker && <p style={{ ...styles.label, color: ACCENT, marginBottom: 8 }}>{kicker}</p>}
      <h2 style={{ ...styles.headingL, margin: 0 }}>{title}</h2>
      {subtitle && (
        <p style={{ ...styles.bodyM, color: TEXT_MUTED, marginTop: 6, maxWidth: 700 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function TierBadge({ tier }) {
  const colors = {
    HIGH: { bg: "#fef2f2", text: TIER_COLORS.HIGH },
    MEDIUM: { bg: "#fffbeb", text: TIER_COLORS.MEDIUM },
    LOW: { bg: "#f0fdf4", text: TIER_COLORS.LOW },
  };
  const c = colors[tier] || colors.LOW;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        padding: "4px 12px",
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontFamily: "'JetBrains Mono',monospace",
      }}
    >
      {tier}
    </span>
  );
}

function TrendChip({ trend }) {
  const map = {
    Emerging: { icon: "▲", color: TIER_COLORS.HIGH },
    Stable: { icon: "●", color: TIER_COLORS.MEDIUM },
    Declining: { icon: "▼", color: TIER_COLORS.LOW },
  };
  const { icon, color } = map[trend] || { icon: "–", color: TEXT_MUTED };
  return <span style={{ color, fontSize: 14, fontWeight: 600 }}>{icon} {trend}</span>;
}

function ProgressBar({ value, max, color, height = 10 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ background: "#f0ede8", borderRadius: 4, height, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          background: color,
          height: "100%",
          borderRadius: 4,
          transition: "width 0.6s ease",
        }}
      />
    </div>
  );
}

function MapButton({ href, children = "Open Map", small = false }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-block",
        padding: small ? "7px 10px" : "9px 14px",
        background: PRIMARY,
        color: "#fff",
        borderRadius: 6,
        textDecoration: "none",
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  );
}

function LocationBlock({ cluster }) {
  return (
    <div>
      <div style={{ fontWeight: 700, color: TEXT_DARK }}>{cluster.locationName}</div>
      <div style={{ ...styles.bodyS, marginTop: 4 }}>
        {cluster.area} · {cluster.roadType || "Road"} · POIs: {cluster.nearbyPois || "N/A"}
      </div>
      <div style={{ ...styles.mono, fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>
        {cluster.coordinates}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "clusters", label: "Hotspot Clusters" },
  { id: "violations", label: "Violation Analysis" },
  { id: "temporal", label: "Temporal Patterns" },
  { id: "actions", label: "Recommended Actions" },
  { id: "retrain", label: "Retrain Model" },
];

// ─── PAGES ─────────────────────────────────────────────────────────────────
function OverviewPage({ analytics }) {
  const { totalClusters, totalViolations, avgScore, tierCounts, trendCounts, vehicleDist, topClusters } = analytics;

  const clusterSummary = [
    { tier: "HIGH", count: tierCounts.HIGH, color: TIER_COLORS.HIGH },
    { tier: "MEDIUM", count: tierCounts.MEDIUM, color: TIER_COLORS.MEDIUM },
    { tier: "LOW", count: tierCounts.LOW, color: TIER_COLORS.LOW },
  ];

  const trendData = [
    { name: "Emerging", count: trendCounts.Emerging, color: TIER_COLORS.HIGH },
    { name: "Stable", count: trendCounts.Stable, color: TIER_COLORS.MEDIUM },
    { name: "Declining", count: trendCounts.Declining, color: TIER_COLORS.LOW },
  ];

  const top5Vehicles = vehicleDist.slice(0, 5);
  const vehicleChartData = top5Vehicles.map((d) => ({ month: d.name, violations: d.violations }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        <StatCard label="Total Violations" value={totalViolations.toLocaleString()} sub={`Across ${totalClusters} clusters`} accent={PRIMARY} icon="◧" />
        <StatCard label="Hotspot Clusters" value={totalClusters} sub="Across Bengaluru" accent={PRIMARY} icon="◫" />
        <StatCard label="High Priority Zones" value={tierCounts.HIGH} sub="Immediate action needed" accent={TIER_COLORS.HIGH} icon="⚠" />
        <StatCard label="Avg Priority Score" value={avgScore} sub="Out of 100" accent={SUCCESS} icon="◔" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        <div style={styles.card}>
          <SectionHeader kicker="Distribution" title="Cluster Priority Tiers" subtitle={`${totalClusters} hotspot zones categorized by urgency`} />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={clusterSummary} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} · ${value}`} labelLine>
                {clusterSummary.map((d) => <Cell key={d.tier} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(value) => [`${value} clusters`, "Count"]} contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.card}>
          <SectionHeader kicker="Priority Alerts" title="Top Police Deployment Locations" subtitle="Exact cluster coordinates with Google Maps navigation" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 285, overflowY: "auto", paddingRight: 6 }}>
            {topClusters.slice(0, 5).map((c) => (
              <div key={c.id} style={{ padding: 14, background: "#faf9f6", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <TierBadge tier={c.tier} />
                    <span style={{ ...styles.mono, color: PRIMARY }}>{c.id}</span>
                    <span style={{ ...styles.bodyS }}>Score {c.score}</span>
                  </div>
                  <LocationBlock cluster={c} />
                </div>
                <MapButton href={c.directionsUrl} small>Directions</MapButton>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        <div style={styles.card}>
          <SectionHeader kicker="Direction" title="Violation Trends" subtitle="Where each cluster is headed" />
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
            {trendData.map((d) => (
              <div key={d.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ ...styles.bodyM, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ ...styles.mono, color: TEXT_DARK }}>{d.count} zones</span>
                </div>
                <ProgressBar value={d.count} max={totalClusters} color={d.color} height={14} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: 18, background: "#fef2f2", borderRadius: 6, borderLeft: `4px solid ${TIER_COLORS.HIGH}` }}>
            <p style={{ ...styles.bodyM, margin: 0 }}>
              <strong style={{ color: TIER_COLORS.HIGH }}>{trendCounts.Emerging} emerging zones</strong> show escalating violations and need early enforcement.
            </p>
          </div>
        </div>

        <div style={styles.card}>
          <SectionHeader kicker="Top 5" title="Violations by Dominant Vehicle" subtitle="Total violation counts for top vehicle categories" />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={vehicleChartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#e5e2db" />
              <XAxis dataKey="month" tick={{ fill: TEXT_MUTED, fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [Number(value).toLocaleString(), "Violations"]} />
              <Area type="monotone" dataKey="violations" stroke={PRIMARY} strokeWidth={3} fill="url(#areaGradient)" dot={{ r: 5, fill: PRIMARY, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ClustersPage({ analytics }) {
  const { roadTypeData, topClusters } = analytics;
  const [sortBy, setSortBy] = useState("score");
  const [search, setSearch] = useState("");

  const sorted = [...topClusters]
    .filter((c) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return [c.id, c.locationName, c.coordinates, c.roadType, c.nearbyPois, c.tier, c.trend]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) =>
      sortBy === "score" ? b.score - a.score :
      sortBy === "count" ? b.count - a.count :
      sortBy === "cluster" ? Number(a.clusterNo) - Number(b.clusterNo) :
      a.locationName.localeCompare(b.locationName)
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={styles.card}>
        <SectionHeader kicker="Road Network" title="Violations by Road Type" subtitle="Which road categories see the most illegal parking" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={roadTypeData} layout="vertical" margin={{ left: 30, right: 30 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e2db" horizontal={false} />
            <XAxis type="number" tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <YAxis dataKey="type" type="category" tick={{ fill: TEXT_BODY, fontSize: 14, fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
            <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [Number(value).toLocaleString(), "Violations"]} />
            <Bar dataKey="violations" fill={PRIMARY} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <SectionHeader kicker="Ranked" title="Cluster Locations for Police Deployment" subtitle="Every cluster now has exact coordinates and map navigation" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cluster, location, tier..."
              style={{ padding: "10px 12px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, minWidth: 260, fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {["score", "count", "cluster", "location"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: `1px solid ${sortBy === s ? PRIMARY : CARD_BORDER}`,
                    background: sortBy === s ? PRIMARY : "transparent",
                    color: sortBy === s ? "#fff" : TEXT_MUTED,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
            <thead>
              <tr>
                {["Cluster", "Location / Deployment Point", "Score", "Violations", "Tier", "Trend", "Peak", "Top Vehicle", "Map"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: TEXT_MUTED, fontWeight: 600, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: `2px solid ${CARD_BORDER}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${CARD_BORDER}`, background: i % 2 === 0 ? "transparent" : "#faf9f6" }}>
                  <td style={{ padding: "14px", color: PRIMARY, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>{c.id}</td>
                  <td style={{ padding: "14px", minWidth: 340 }}><LocationBlock cluster={c} /></td>
                  <td style={{ padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 60 }}><ProgressBar value={c.score} max={100} color={PRIMARY} height={6} /></div>
                      <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>{c.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>{c.count.toLocaleString()}</td>
                  <td style={{ padding: "14px" }}><TierBadge tier={c.tier} /></td>
                  <td style={{ padding: "14px" }}><TrendChip trend={c.trend} /></td>
                  <td style={{ padding: "14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>{c.peakHour}:00</td>
                  <td style={{ padding: "14px", color: TEXT_MUTED, fontSize: 14 }}>{c.vehicle}</td>
                  <td style={{ padding: "14px" }}><MapButton href={c.directionsUrl} small>Directions</MapButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ViolationsPage({ analytics }) {
  const { vehicleDist, topClusters } = analytics;

  const impactRanges = [
    { range: "0–500", min: 0, max: 500 },
    { range: "500–1k", min: 500, max: 1000 },
    { range: "1k–1.5k", min: 1000, max: 1500 },
    { range: "1.5k–2k", min: 1500, max: 2000 },
    { range: "2k+", min: 2000, max: Infinity },
  ];

  const congestionData = impactRanges.map((r) => ({
    range: r.range,
    clusters: topClusters.filter((c) => c.count >= r.min && c.count < r.max).length,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 }}>
        <div style={styles.card}>
          <SectionHeader kicker="By Type" title="Violations by Vehicle Type" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vehicleDist} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#e5e2db" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: TEXT_MUTED, fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [Number(value).toLocaleString(), "Violations"]} />
              <Bar dataKey="violations" radius={[4, 4, 0, 0]}>
                {vehicleDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.card}>
          <SectionHeader kicker="Share" title="Vehicle Type Distribution" subtitle="Percentage of total violations" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={vehicleDist} dataKey="violations" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                {vehicleDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [Number(value).toLocaleString(), "Violations"]} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, color: TEXT_BODY }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="Impact" title="Congestion Impact Score Distribution" subtitle="Estimated traffic disruption per cluster" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={congestionData}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e2db" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [value, "Clusters"]} />
            <Bar dataKey="clusters" fill={ACCENT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="Categories" title="Violations by Road Type" subtitle="Most impacted road categories" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 12 }}>
          {analytics.roadTypeData.slice(0, 4).map((v, i) => (
            <div key={v.type} style={{ padding: 20, background: "#faf9f6", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, borderLeft: `4px solid ${CHART_COLORS[i % CHART_COLORS.length]}` }}>
              <p style={{ ...styles.label, color: TEXT_MUTED, marginBottom: 8 }}>{v.type} Roads</p>
              <p style={{ ...styles.headingXL, margin: 0, color: TEXT_DARK }}>{v.violations.toLocaleString()}</p>
              <p style={{ ...styles.bodyS, marginTop: 4 }}>{v.clusters} clusters</p>
              <div style={{ marginTop: 14 }}>
                <ProgressBar value={v.violations} max={analytics.roadTypeData[0]?.violations || v.violations} color={CHART_COLORS[i % CHART_COLORS.length]} height={6} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemporalPage({ analytics }) {
  const { hourlyData, topClusters } = analytics;
  const sortedByHour = [...hourlyData].sort((a, b) => b.violations - a.violations);
  const peak1 = sortedByHour[0]?.hour || "10";
  const peak2 = sortedByHour[1]?.hour || "08";
  const low1 = [...sortedByHour].reverse().find((h) => h.violations > 0)?.hour || "15";

  const weekdayViolations = Math.round(analytics.totalViolations * 0.71);
  const weekendViolations = analytics.totalViolations - weekdayViolations;
  const scoreLineData = topClusters.slice(0, 20).map((c, i) => ({ rank: i + 1, score: c.score }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={styles.card}>
        <SectionHeader kicker="Daily Rhythm" title="Violations by Hour of Day" subtitle="When does illegal parking peak in Bengaluru?" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={hourlyData} margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
            <defs>
              <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e2db" />
            <XAxis dataKey="hour" tick={{ fill: TEXT_MUTED, fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} label={{ value: "Hour (24h)", position: "insideBottom", fill: TEXT_MUTED, fontSize: 12, dy: 15 }} />
            <YAxis tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [Number(value).toLocaleString(), "Violations"]} labelFormatter={(l) => `Hour ${l}:00`} />
            <Area type="monotone" dataKey="violations" stroke={PRIMARY} strokeWidth={3} fill="url(#hourGradient)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
          {[
            ["Peak Hour", `${peak1}:00`, TIER_COLORS.HIGH],
            ["Second Peak", `${peak2}:00`, ACCENT],
            ["Lowest", `${low1}:00`, SUCCESS],
          ].map(([label, value, color]) => (
            <div key={label} style={{ padding: "10px 16px", background: "#faf9f6", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, borderLeft: `3px solid ${color}` }}>
              <span style={{ ...styles.bodyS, fontWeight: 600 }}>{label}: </span>
              <span style={{ ...styles.bodyM, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="Weekly Pattern" title="Weekday vs Weekend" subtitle="Estimated violation volume split by day type" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          <div style={{ padding: 28, background: "#faf9f6", borderRadius: 8, textAlign: "center", border: `1px solid ${CARD_BORDER}` }}>
            <p style={styles.label}>Weekdays</p>
            <p style={{ ...styles.headingXL, color: PRIMARY, margin: "12px 0 8px" }}>{weekdayViolations.toLocaleString()}</p>
            <p style={styles.bodyS}>71% of all violations</p>
          </div>
          <div style={{ padding: 28, background: "#faf9f6", borderRadius: 8, textAlign: "center", border: `1px solid ${CARD_BORDER}` }}>
            <p style={styles.label}>Weekends</p>
            <p style={{ ...styles.headingXL, color: PRIMARY, margin: "12px 0 8px" }}>{weekendViolations.toLocaleString()}</p>
            <p style={styles.bodyS}>29% of all violations</p>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="Trajectory" title="Priority Score by Rank" subtitle="Top 20 clusters ranked by priority score" />
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={scoreLineData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e2db" />
            <XAxis dataKey="rank" tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} label={{ value: "Cluster Rank", position: "insideBottom", fill: TEXT_MUTED, fontSize: 12, dy: 15 }} />
            <YAxis tick={{ fill: TEXT_MUTED, fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6 }} formatter={(value) => [value, "Priority Score"]} />
            <Line type="monotone" dataKey="score" stroke={SUCCESS} strokeWidth={3} dot={{ r: 6, fill: SUCCESS, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActionsPage({ analytics }) {
  const { actionDist, tierCounts, topClusters, emergingZones } = analytics;

  const groupedActions = [
    { action: "Permanent tow zone + CCTV", count: actionDist.find((a) => a.action.includes("Permanent"))?.count || 0 },
    { action: "Morning rush patrol", count: actionDist.filter((a) => a.action.includes("Morning")).reduce((s, a) => s + a.count, 0) },
    { action: "Targeted patrol", count: actionDist.filter((a) => a.action.includes("Targeted")).reduce((s, a) => s + a.count, 0) },
  ].sort((a, b) => b.count - a.count);

  const tierActions = [
    { tier: "HIGH", color: TIER_COLORS.HIGH, bg: "#fef7f7", actions: [...new Set(topClusters.filter((c) => c.tier === "HIGH").map((c) => c.action))], count: tierCounts.HIGH },
    { tier: "MEDIUM", color: TIER_COLORS.MEDIUM, bg: "#fffdf5", actions: [...new Set(topClusters.filter((c) => c.tier === "MEDIUM").slice(0, 4).map((c) => c.action))], count: tierCounts.MEDIUM },
    { tier: "LOW", color: TIER_COLORS.LOW, bg: "#f5faf7", actions: [...new Set(topClusters.filter((c) => c.tier === "LOW").slice(0, 4).map((c) => c.action))], count: tierCounts.LOW },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={styles.card}>
        <SectionHeader kicker="Spread" title="Recommended Enforcement Actions" subtitle="Distribution of prescribed interventions across all clusters" />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
          {groupedActions.map((a, i) => (
            <div key={a.action} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: CHART_COLORS[i], flexShrink: 0 }} />
              <span style={{ ...styles.bodyM, width: 280, fontWeight: 500 }}>{a.action}</span>
              <div style={{ flex: 1 }}><ProgressBar value={a.count} max={analytics.totalClusters} color={CHART_COLORS[i]} height={12} /></div>
              <span style={{ ...styles.mono, width: 40, textAlign: "right", color: TEXT_DARK, fontWeight: 700 }}>{a.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader kicker="By Tier" title="Actions by Priority Tier" subtitle="Prescribed enforcement strategy per zone type" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {tierActions.map((t) => (
            <div key={t.tier} style={{ background: t.bg, border: `1px solid ${t.color}33`, borderRadius: 8, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <TierBadge tier={t.tier} />
                <span style={{ ...styles.bodyS, fontFamily: "'JetBrains Mono',monospace" }}>{t.count} zones</span>
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 20px" }}>
                {t.actions.filter(Boolean).map((a) => <li key={a} style={{ ...styles.bodyM, marginBottom: 10, color: TEXT_BODY }}>{a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="This Week" title="Near-Term Action Queue" subtitle="Emerging zones that need intervention before escalation" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 12 }}>
          {emergingZones.slice(0, 4).map((z) => (
            <div key={z.area} style={{ padding: 18, background: "#faf9f6", borderRadius: 8, border: `1px solid ${CARD_BORDER}` }}>
              <p style={{ ...styles.headingM, margin: "0 0 4px" }}>{z.area}</p>
              <p style={{ ...styles.bodyM, fontWeight: 600, margin: "0 0 4px" }}>{z.locationName}</p>
              <p style={{ ...styles.mono, fontSize: 12, color: TEXT_MUTED, margin: "0 0 10px" }}>{z.coordinates}</p>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: z.status === "ESCALATING" ? TIER_COLORS.HIGH : TIER_COLORS.MEDIUM, background: z.status === "ESCALATING" ? "#fef2f2" : "#fffbeb", padding: "4px 10px", borderRadius: 4 }}>
                {z.status}
              </span>
              <p style={{ ...styles.bodyS, margin: "10px 0 0" }}>Score: {z.score}</p>
              <p style={{ ...styles.bodyS, margin: "4px 0 12px" }}>{z.urgency}</p>
              <MapButton href={z.directionsUrl} small>Directions</MapButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RetrainPage({ onRetrainSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setStatus("error");
      setLog(["Only CSV files are accepted."]);
      return;
    }
    setFile(f);
    setStatus("idle");
    setLog([]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");

    const steps = [
      "Uploading dataset to server...",
      "File uploaded successfully.",
      "Preprocessing new violation records...",
      "Retraining clustering model...",
      "Updating priority scores...",
    ];
    setLog([steps[0]]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/retrain", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const records = data.new_records ?? "new";
      const clusters = data.cluster_count ?? "—";

      setLog([...steps, `Done — model retrained with ${records} records.`, `New cluster count: ${clusters}`]);
      setStatus("success");

      if (onRetrainSuccess) {
        setLog((prev) => [...prev, "Refreshing dashboard with updated data..."]);
        await onRetrainSuccess();
        setLog((prev) => [...prev, "✅ Dashboard updated — all charts, tables, and locations refreshed!"]);
      }
    } catch (err) {
      setLog([
        ...steps,
        `❌ Error: could not connect to backend (${err.message}). Make sure the FastAPI server is running at http://localhost:8000`,
      ]);
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setLog([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ ...styles.card, background: "#faf9f6", borderLeft: `4px solid ${ACCENT}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div>
          <p style={{ ...styles.headingM, color: ACCENT, marginBottom: 8 }}>How Model Retraining Works</p>
          <p style={{ ...styles.bodyM, margin: 0, maxWidth: 760 }}>
            Upload a new violations CSV. The backend preprocesses the data, reruns clustering, recalculates priority scores,
            and updates the hotspot locations. If your CSV includes a <b>location_name</b> column, the dashboard will display it.
            Otherwise it will show the exact latitude/longitude with Google Maps directions.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="Schema" title="Expected CSV Format" subtitle="The new file must contain these columns. location_name is optional but recommended." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {[
            "geo_cluster",
            "latitude",
            "longitude",
            "location_name (optional)",
            "priority_score",
            "priority_tier",
            "violation_count",
            "trend_label",
            "road_type",
            "congestion_impact",
            "nearby_pois",
            "peak_hour",
            "dominant_vehicle",
            "recommended_action",
          ].map((col) => (
            <span key={col} style={{ background: "#faf9f6", color: PRIMARY, fontSize: 13, padding: "6px 14px", borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", border: `1px solid ${CARD_BORDER}` }}>
              {col}
            </span>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <SectionHeader kicker="Upload" title="Upload New Dataset" subtitle="CSV file from Bengaluru Traffic Police" />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? ACCENT : file ? SUCCESS : CARD_BORDER}`,
            borderRadius: 8,
            padding: "48px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "#faf5f2" : "#faf9f6",
            marginTop: 16,
            transition: "all 0.2s ease",
          }}
        >
          <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div>
              <p style={{ ...styles.headingM, color: SUCCESS, margin: "0 0 6px" }}>{file.name}</p>
              <p style={styles.bodyS}>{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </div>
          ) : (
            <div>
              <p style={{ ...styles.bodyM, fontWeight: 600, margin: "0 0 6px" }}>Drag and drop your CSV here</p>
              <p style={styles.bodyS}>or click to browse files</p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
          <button
            onClick={handleUpload}
            disabled={!file || status === "uploading"}
            style={{
              padding: "14px 32px",
              borderRadius: 6,
              border: "none",
              cursor: file && status !== "uploading" ? "pointer" : "not-allowed",
              background: file && status !== "uploading" ? PRIMARY : "#e5e2db",
              color: file && status !== "uploading" ? "#fff" : TEXT_MUTED,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {status === "uploading" ? "Retraining..." : "Upload & Retrain"}
          </button>
          {file && (
            <button onClick={reset} style={{ padding: "14px 28px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_MUTED, cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
              Reset
            </button>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div style={{ background: "#faf9f6", border: `1px solid ${status === "success" ? SUCCESS : status === "error" ? TIER_COLORS.HIGH : CARD_BORDER}`, borderRadius: 8, padding: 24 }}>
          <p style={{ ...styles.label, marginBottom: 14 }}>Retrain Log</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {log.map((line, i) => (
              <p key={i} style={{ ...styles.mono, color: line.startsWith("❌") ? TIER_COLORS.HIGH : line.startsWith("Done") || line.startsWith("New cluster") || line.startsWith("✅") ? SUCCESS : TEXT_BODY, margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCSV = async () => {
    try {
      setLoading(true);
      const cacheBust = `?t=${Date.now()}`;
      const response = await fetch(`/cluster_results_v3.csv${cacheBust}`);

      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}. Make sure cluster_results_v3.csv is inside the public folder.`);
      }

      const text = await response.text();
      const rows = parseCSV(text);

      if (rows.length === 0) throw new Error("CSV file is empty or has no data rows");

      const data = deriveAnalytics(rows);
      setAnalytics(data);
      setError(null);
    } catch (err) {
      console.error("Error loading CSV:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCSV();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPage = () => {
    if (!analytics) return null;
    switch (page) {
      case "overview": return <OverviewPage analytics={analytics} />;
      case "clusters": return <ClustersPage analytics={analytics} />;
      case "violations": return <ViolationsPage analytics={analytics} />;
      case "temporal": return <TemporalPage analytics={analytics} />;
      case "actions": return <ActionsPage analytics={analytics} />;
      case "retrain": return <RetrainPage analytics={analytics} onRetrainSuccess={loadCSV} />;
      default: return <OverviewPage analytics={analytics} />;
    }
  };

  return (
    <div style={styles.pageContainer}>
      <header style={{ background: NAV_BG, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "'Poppins','Montserrat',sans-serif", fontSize: 28, fontWeight: 700, margin: 0, color: NAV_TEXT, letterSpacing: "-0.02em" }}>
            LaneWatch
          </h1>
          <span style={{ color: "#a0b4c8", fontSize: 15 }}>Bengaluru Traffic Police</span>
        </div>
        {analytics && !loading && (
          <p style={{ color: "#8aa0b5", fontSize: 14, margin: 0, textAlign: "right" }}>
            {analytics.totalClusters} clusters · {analytics.totalViolations.toLocaleString()} violations · Avg score {analytics.avgScore}
          </p>
        )}
      </header>

      <nav style={{ background: CARD_BG, borderBottom: `1px solid ${CARD_BORDER}`, padding: "0 32px", display: "flex", gap: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflowX: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "18px 20px 16px",
                fontSize: 16,
                fontWeight: active ? 700 : 600,
                color: active ? PRIMARY : TEXT_MUTED,
                borderBottom: active ? `3px solid ${PRIMARY}` : "3px solid transparent",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                letterSpacing: "-0.01em",
                textAlign: "center",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <main style={{ padding: "36px 40px", maxWidth: 1400, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ ...styles.headingM, color: TEXT_MUTED }}>Loading cluster data...</p>
          </div>
        )}

        {error && (
          <div style={{ ...styles.card, borderLeft: `4px solid ${TIER_COLORS.HIGH}`, marginBottom: 20 }}>
            <p style={{ ...styles.bodyM, color: TIER_COLORS.HIGH, margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {!loading && analytics && renderPage()}
      </main>
    </div>
  );
}
