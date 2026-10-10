"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart3, BookOpen, ChevronRight, CloudDownload, Database, FileUp,
  Gauge, LayoutDashboard, Lightbulb, Menu, Search, Settings2, Sprout,
  TrendingUp, Upload, X
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";

type Row = {
  country: string; year: number; crop: string; production: number;
  area?: number; quantity_sold?: number; selling_price?: number; revenue?: number;
  total_cost?: number; farmer_income?: number; water_used?: number;
  fertilizer_used?: number; pesticide_used?: number; carbon_emissions?: number;
  rainfall?: number; temperature?: number; drought_index?: number;
  flood_events?: number; heatwave_days?: number;
};
type Section = "Overview" | "Data import" | "Visualizations" | "Forecasting" | "KPI evaluation" | "Recommendations" | "Methodology";

const SOURCES = [
  { crop: "Rice", slug: "rice-production.csv" },
  { crop: "Maize", slug: "maize-production.csv" },
  { crop: "Wheat", slug: "wheat-production.csv" },
  { crop: "Soybeans", slug: "soybean-production.csv" }
];
const DATA_BASE = "https://ourworldindata.org/grapher/";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function parseOwid(csv: string, crop: string): Row[] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
  if (parsed.length < 2) return [];
  const header = parsed[0];
  const yearIndex = header.findIndex((v) => v.toLowerCase() === "year");
  const entityIndex = header.findIndex((v) => v.toLowerCase() === "entity");
  const productionIndex = header.findIndex((v) => v.toLowerCase().includes("production"));
  return parsed.slice(1).map((r) => ({
    country: String(r[entityIndex] ?? ""),
    year: Number(r[yearIndex]),
    crop,
    production: Number(r[productionIndex])
  })).filter((r) => r.country && Number.isFinite(r.year) && Number.isFinite(r.production));
}

function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
function formatNumber(n: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n);
}

export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [country, setCountry] = useState("India");
  const [crop, setCrop] = useState("All crops");
  const [year, setYear] = useState("All years");
  const [targetGrowth, setTargetGrowth] = useState(5);
  const [uploadMessage, setUploadMessage] = useState("");
  const [dataSource, setDataSource] = useState("OWID / FAOSTAT");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [visualChart, setVisualChart] = useState<"line" | "bar" | "histogram">("line");

  useEffect(() => {
    Promise.all(SOURCES.map(async (source) => {
      const response = await fetch(DATA_BASE + source.slug);
      if (!response.ok) throw new Error(`Could not download ${source.crop} data`);
      return parseOwid(await response.text(), source.crop);
    })).then((datasets) => {
      setRows(datasets.flat());
      setLastUpdated(new Date());
    })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const countries = useMemo(() => Array.from(new Set(rows.map((r) => r.country))).sort(), [rows]);
  const crops = useMemo(() => Array.from(new Set(rows.map((r) => r.crop))).sort(), [rows]);
  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b), [rows]);
  const filtered = useMemo(() => rows.filter((r) =>
    (country === "All geographies" || r.country === country) && (crop === "All crops" || r.crop === crop) &&
    (year === "All years" || r.year === Number(year))
  ), [rows, country, crop, year]);

  const yearly = useMemo(() => {
    const map = new Map<number, number>();
    filtered.forEach((r) => map.set(r.year, (map.get(r.year) ?? 0) + r.production));
    return Array.from(map, ([name, production]) => ({ name, production })).sort((a, b) => a.name - b.name);
  }, [filtered]);
  const byCrop = useMemo(() => crops.map((name) => ({
    name, production: filtered.filter((r) => r.crop === name).reduce((s, r) => s + r.production, 0)
  })).filter((r) => r.production > 0).sort((a, b) => b.production - a.production), [crops, filtered]);
  const total = filtered.reduce((s, r) => s + r.production, 0);
  const latestYear = yearly.at(-1)?.name;
  const firstYear = yearly[0]?.name;
  const growth = yearly.length > 1 && yearly[0].production > 0
    ? ((yearly.at(-1)!.production - yearly[0].production) / yearly[0].production) * 100 : 0;
  const concentration = total ? ((byCrop[0]?.production ?? 0) / total) * 100 : 0;

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`${API_BASE}/api/data/upload`, { method: "POST", body: form });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail ?? "The Python data service rejected this CSV.");
      }
      const result = await response.json() as { records: Row[]; source: string; quality: { records_after: number } };
      const imported = result.records;
      setRows(imported);
      setCountry(imported[0].country);
      setCrop("All crops");
      setYear("All years");
      setDataSource(result.source);
      setLastUpdated(new Date());
      setUploadMessage(`Python analytics cleaned ${result.quality.records_after} valid rows and refreshed all charts.`);
      return;
    } catch (backendError) {
      console.warn("FastAPI upload unavailable; using browser validation fallback.", backendError);
    }
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const yearKey = Object.keys(result.data[0] ?? {}).find((h) => h.toLowerCase().includes("year"));
        const productionKey = Object.keys(result.data[0] ?? {}).find((h) => h.toLowerCase().includes("production") || h.toLowerCase().includes("yield"));
        const cropKey = Object.keys(result.data[0] ?? {}).find((h) => h.toLowerCase().includes("crop"));
        if (!yearKey || !productionKey) { setUploadMessage("Validation failed: CSV needs Year and Production columns."); return; }
        const imported = result.data.map((r) => ({
          country: r.State || r.state || r.Country || r.country || "Uploaded dataset",
          year: Number(r[yearKey]), crop: r[cropKey ?? "Crop"] || "Uploaded crop",
          production: Number(String(r[productionKey]).replace(/,/g, ""))
        })).filter((r) => Number.isFinite(r.year) && Number.isFinite(r.production) && r.production >= 0);
        if (!imported.length) {
          setUploadMessage("Validation failed: no valid rows were found in this CSV.");
          return;
        }
        setRows(imported);
        setCountry(imported[0].country);
        setCrop("All crops");
        setYear("All years");
        setDataSource(`Uploaded CSV · ${file.name}`);
        setLastUpdated(new Date());
        setUploadMessage(`Loaded ${imported.length} valid rows and refreshed all charts. Invalid and incomplete records were excluded.`);
      },
      error: () => setUploadMessage("Could not read this file. Please upload a valid CSV.")
    });
  }

  function downloadCsv() {
    const csv = Papa.unparse(filtered.map((r) => ({ Country: r.country, Year: r.year, Crop: r.crop, Production_tonnes: r.production })));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "agrivision-filtered-production.csv"; link.click(); URL.revokeObjectURL(link.href);
  }

  const nav: { label: Section; icon: React.ReactNode }[] = [
    { label: "Overview", icon: <LayoutDashboard size={18} /> },
    { label: "Data import", icon: <Database size={18} /> },
    { label: "Visualizations", icon: <BarChart3 size={18} /> },
    { label: "Forecasting", icon: <TrendingUp size={18} /> },
    { label: "KPI evaluation", icon: <Gauge size={18} /> },
    { label: "Recommendations", icon: <Lightbulb size={18} /> },
    { label: "Methodology", icon: <BookOpen size={18} /> }
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sprout size={22} /></div><div><strong>AgriVision</strong><small>AGRIBUSINESS ANALYTICS</small></div></div>
      <div className="workspace-label">WORKSPACE <Settings2 size={13} /></div>
      <nav>{nav.map((item) => <button key={item.label} className={section === item.label ? "active" : ""} onClick={() => setSection(item.label)}>{item.icon}<span>{item.label}</span>{section === item.label && <ChevronRight size={15} className="nav-chevron" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="data-status"><span className={loading ? "dot loading" : "dot"}></span><div><b>{loading ? "Loading live data" : "Live data connected"}</b><small>Our World in Data · FAOSTAT</small></div></div><div className="profile"><div className="avatar">JA</div><div><b>Junior Analyst</b><small>Internship workspace</small></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="breadcrumb">Workspace <span>/</span> <b>{section}</b></div><div className="top-actions"><div className="search"><Search size={16} /><input placeholder="Search insights..." /></div><button className="outline-button" onClick={downloadCsv}><CloudDownload size={16} /> Export data</button></div></header>
      <div className="content">
        {error && <div className="alert error">{error} Check your internet connection and reload.</div>}
        <div className="page-heading"><div><p className="eyebrow">AGRICULTURAL INTELLIGENCE · 2026</p><h1>{section === "Overview" ? "Production overview" : section}</h1><p className="subtitle">{section === "Overview" ? "Turn production data into decisions you can defend." : "Explore the evidence behind your agribusiness decisions."}</p><p className="data-source">Source: <b>{dataSource}</b>{lastUpdated && <> · Updated {lastUpdated.toLocaleTimeString()}</>}</p></div>{section !== "KPI evaluation" && <div className="filters"><label>Country<select value={country} onChange={(e) => setCountry(e.target.value)}><option>All geographies</option>{countries.slice(0, 80).map((c) => <option key={c}>{c}</option>)}</select></label><label>Crop<select value={crop} onChange={(e) => setCrop(e.target.value)}><option>All crops</option>{crops.map((c) => <option key={c}>{c}</option>)}</select></label><label>Year<select value={year} onChange={(e) => setYear(e.target.value)}><option>All years</option>{years.slice(-30).map((y) => <option key={y}>{y}</option>)}</select></label></div>}</div>
        {section === "Data import" ? <ImportPanel upload={upload} message={uploadMessage} rowCount={rows.length} source={dataSource} /> : section === "Methodology" ? <Methodology rows={rows} filtered={filtered} source={dataSource} lastUpdated={lastUpdated} /> : section === "Forecasting" ? <Forecast yearly={yearly} /> : section === "KPI evaluation" ? <Kpi filtered={filtered} total={total} growth={growth} concentration={concentration} targetGrowth={targetGrowth} setTargetGrowth={setTargetGrowth} /> : section === "Recommendations" ? <Recommendations filtered={filtered} growth={growth} concentration={concentration} targetGrowth={targetGrowth} crop={byCrop[0]?.name} /> : section === "Visualizations" ? <Visualizations filtered={filtered} byCrop={byCrop} chartType={visualChart} setChartType={setVisualChart} loading={loading} /> : <Dashboard filtered={filtered} yearly={yearly} byCrop={byCrop} total={total} countries={countries} years={years} latestYear={latestYear} firstYear={firstYear} growth={growth} concentration={concentration} loading={loading} />}
      </div>
    </main>
  </div>;
}

function Dashboard({ filtered, yearly, byCrop, total, countries, years, latestYear, firstYear, growth, concentration, loading }: { filtered: Row[]; yearly: { name: number; production: number }[]; byCrop: { name: string; production: number }[]; total: number; countries: string[]; years: number[]; latestYear?: number; firstYear?: number; growth: number; concentration: number; loading: boolean }) {
  return <>{loading ? <div className="loading-card">Loading official crop production series…</div> : <><div className="kpi-grid"><KpiCard label="Total production" value={`${compact(total)} t`} detail={`${firstYear ?? "—"}–${latestYear ?? "—"} selected period`} trend={growth} /><KpiCard label="Crop categories" value={String(byCrop.length)} detail="Across selected geography" /><KpiCard label="Years available" value={String(years.length)} detail={years.length ? `${years[0]} to ${years.at(-1)}` : "No records"} /><KpiCard label="Concentration" value={`${concentration.toFixed(1)}%`} detail={byCrop[0] ? `${byCrop[0].name} share of total` : "Top crop share"} /></div><div className="chart-grid"><section className="card chart-card wide"><div className="card-heading"><div><h2>Production trend</h2><p>Annual production · tonnes</p></div><span className="live-tag">● LIVE DATA</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={yearly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece8" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#718078" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: "#718078" }} tickLine={false} axisLine={false} tickFormatter={compact} /><Tooltip formatter={(v: number) => [formatNumber(v) + " tonnes", "Production"]} /><Line type="monotone" dataKey="production" stroke="#237b59" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></section><section className="card chart-card"><div className="card-heading"><div><h2>Crop mix</h2><p>Selected period</p></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={byCrop} layout="vertical" margin={{ left: 8, right: 18 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7ece8" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#52635a" }} width={65} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => [formatNumber(v) + " tonnes", "Production"]} /><Bar dataKey="production" fill="#66a882" radius={[0, 5, 5, 0]} barSize={18} /></BarChart></ResponsiveContainer></div></section></div><section className="insight-row"><div className="insight-icon"><TrendingUp size={19} /></div><div><b>{growth >= 0 ? "Production is trending upward" : "Production is trending downward"}</b><p>Across the selected period, total production changed <strong>{Math.abs(growth).toFixed(1)}%</strong>. This is a descriptive signal, not a causal explanation.</p></div><ChevronRight size={18} /></section><div className="table-card card"><div className="card-heading"><div><h2>Data preview</h2><p>{filtered.length.toLocaleString()} filtered records · production in tonnes</p></div></div><div className="table-wrap"><table><thead><tr><th>Year</th><th>Crop</th><th>Geography</th><th className="right">Production</th></tr></thead><tbody>{filtered.slice(-8).reverse().map((r, i) => <tr key={`${r.year}-${r.crop}-${i}`}><td>{r.year}</td><td><span className="crop-dot"></span>{r.crop}</td><td>{r.country}</td><td className="right">{formatNumber(r.production)} t</td></tr>)}</tbody></table></div></div></>}</>;
}

function Visualizations({ filtered, byCrop, chartType, setChartType, loading }: { filtered: Row[]; byCrop: { name: string; production: number }[]; chartType: "line" | "bar" | "histogram"; setChartType: (type: "line" | "bar" | "histogram") => void; loading: boolean }) {
  const yearly = useMemo(() => {
    const grouped = new Map<number, number>();
    filtered.forEach((row) => grouped.set(row.year, (grouped.get(row.year) ?? 0) + row.production));
    return Array.from(grouped, ([year, production]) => ({ name: year, production })).sort((a, b) => a.name - b.name);
  }, [filtered]);
  const histogram = useMemo(() => {
    if (!filtered.length) return [];
    const values = filtered.map((row) => row.production);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(values.length))));
    const width = max === min ? 1 : (max - min) / binCount;
    return Array.from({ length: binCount }, (_, index) => {
      const start = min + index * width;
      const end = index === binCount - 1 ? max + 0.0001 : start + width;
      return {
        name: `${compact(start)}–${compact(end)}`,
        records: values.filter((value) => value >= start && value < end).length
      };
    });
  }, [filtered]);
  const chartData = chartType === "histogram" ? histogram : yearly;
  const chartTitle = chartType === "histogram" ? "Production distribution" : chartType === "bar" ? "Yearly production comparison" : "Yearly production trend";
  const chartDescription = chartType === "histogram" ? "Number of records in each production range" : "Aggregated production by year · tonnes";

  const chart = chartType === "line"
    ? <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece8" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tickFormatter={compact} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [formatNumber(value) + " tonnes", "Production"]} /><Line type="monotone" dataKey="production" stroke="#16734f" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart>
    : chartType === "bar"
      ? <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece8" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tickFormatter={compact} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [formatNumber(value) + " tonnes", "Production"]} /><Bar dataKey="production" fill="#2c9a68" radius={[6, 6, 0, 0]} /></BarChart>
      : <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece8" /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [value, "Records"]} /><Bar dataKey="records" fill="#b97542" radius={[6, 6, 0, 0]} /></BarChart>;

  return <div className="visual-workspace">
    <section className="visual-hero">
      <div><p className="eyebrow">EXPLORATION LAB</p><h2>Choose how to read the data</h2><p>Overview summarizes the selected data. This workspace lets you change the chart form and inspect patterns in detail.</p></div>
      <div className="chart-switcher" role="group" aria-label="Chart type">
        <button className={chartType === "line" ? "selected" : ""} onClick={() => setChartType("line")}>Line trend</button>
        <button className={chartType === "bar" ? "selected" : ""} onClick={() => setChartType("bar")}>Bar comparison</button>
        <button className={chartType === "histogram" ? "selected" : ""} onClick={() => setChartType("histogram")}>Histogram</button>
      </div>
    </section>
    {loading ? <div className="loading-card">Loading visualization data…</div> : <><div className="visual-grid"><section className="card chart-card visual-main"><div className="card-heading"><div><h2>{chartTitle}</h2><p>{chartDescription}</p></div><span className="live-tag">{filtered.length.toLocaleString()} RECORDS</span></div><div className="chart visual-chart"><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div></section><section className="card chart-card"><div className="card-heading"><div><h2>Crop comparison</h2><p>Selected filter context</p></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={byCrop} layout="vertical" margin={{ left: 8, right: 18 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7ece8" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={78} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [formatNumber(value) + " tonnes", "Production"]} /><Bar dataKey="production" fill="#82bd91" radius={[0, 6, 6, 0]} barSize={22} /></BarChart></ResponsiveContainer></div></section></div><div className="visual-note"><BarChart3 size={20} /><span><b>Chart guide:</b> use Line for change over time, Bar for category comparisons, and Histogram to inspect how production values are distributed across records.</span></div></>}
  </div>;
}

function KpiCard({ label, value, detail, trend }: { label: string; value: string; detail: string; trend?: number }) { return <div className="kpi-card"><p>{label}</p><strong>{value}</strong><small>{trend !== undefined && <span className={trend >= 0 ? "positive" : "negative"}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}% </span>}{detail}</small></div>; }
function ImportPanel({ upload, message, rowCount, source }: { upload: (file: File) => void; message: string; rowCount: number; source: string }) { return <div className="panel-stack"><section className="card import-card"><div className="upload-icon"><Upload size={24} /></div><p className="eyebrow">DATA WORKBENCH</p><h2>Bring your field data to life</h2><p>Upload a CSV with at least <b>Year</b> and <b>Production</b> columns. Every chart, KPI, forecast, recommendation, and methodology note will recalculate from the uploaded rows.</p><label className="upload-button"><FileUp size={17} /> Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>{message && <div className="alert success">{message}</div>}</section><div className="kpi-grid import-stats"><KpiCard label="Active records" value={rowCount.toLocaleString()} detail="Rows currently powering the app" /><KpiCard label="Active source" value={source.startsWith("Uploaded") ? "Your CSV" : "OWID"} detail="Traceable dataset context" /><KpiCard label="Refresh behavior" value="Instant" detail="Charts update after validation" /><KpiCard label="Quality gate" value="Enabled" detail="Invalid rows are excluded" /></div><section className="card"><div className="card-heading"><div><h2>Data quality rules</h2><p>Applied before the dataset becomes active</p></div></div><div className="quality-list"><div><span>01</span><b>Schema validation</b><p>Checks required Year and Production columns.</p></div><div><span>02</span><b>Numeric validation</b><p>Removes non-numeric years, negative production, and malformed values.</p></div><div><span>03</span><b>Missing values</b><p>Incomplete rows are excluded and the valid-row count is reported.</p></div><div><span>04</span><b>Full recalculation</b><p>Recommendations and methodology update from the same active dataset.</p></div></div></section></div>; }
function Forecast({ yearly }: { yearly: { name: number; production: number }[] }) { const window = yearly.slice(-5); const average = window.length ? window.reduce((s, r) => s + r.production, 0) / window.length : 0; const data = [...yearly.slice(-10).map((r) => ({ ...r, kind: "Historical" })), ...[1, 2, 3].map((n) => ({ name: (yearly.at(-1)?.name ?? 2024) + n, production: average, kind: "Forecast" }))]; return <div className="panel-stack"><section className="card chart-card forecast-card"><div className="card-heading"><div><h2>Baseline forecast</h2><p>Five-year moving average · selected geography and crop filters</p></div><span className="method-tag">MOVING AVERAGE</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece8" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compact} tick={{ fontSize: 11 }} /><Tooltip formatter={(v: number) => [formatNumber(v) + " t", "Production"]} /><Line dataKey="production" stroke="#237b59" strokeWidth={3} dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div></section><div className="two-col"><div className="card metric-card"><p>Next-year baseline</p><strong>{formatNumber(average)} t</strong><small>Average of the last {window.length} available years</small></div><div className="card limitation"><b>Model limitation</b><p>This is a transparent baseline, not a guaranteed outcome. It does not model weather, prices, policy, area changes, or shocks. Use chronological holdout testing before making operational decisions.</p></div></div></div>; }
function Kpi({ filtered, total, growth, concentration, targetGrowth, setTargetGrowth }: { filtered: Row[]; total: number; growth: number; concentration: number; targetGrowth: number; setTargetGrowth: (v: number) => void }) {
  const sum = (key: keyof Row) => filtered.reduce((value, row) => value + (typeof row[key] === "number" ? row[key] as number : 0), 0);
  const average = (key: keyof Row) => { const values = filtered.map((row) => row[key]).filter((value): value is number => typeof value === "number"); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; };
  const revenue = filtered.some((row) => typeof row.revenue === "number") ? sum("revenue") : filtered.some((row) => typeof row.quantity_sold === "number" && typeof row.selling_price === "number") ? filtered.reduce((value, row) => value + (row.quantity_sold ?? 0) * (row.selling_price ?? 0), 0) : null;
  const costs = filtered.some((row) => typeof row.total_cost === "number") ? sum("total_cost") : null;
  const profit = revenue !== null && costs !== null ? revenue - costs : null;
  const validAreaRows = filtered.filter((row) => typeof row.area === "number" && row.area > 0);
  const yieldValue = validAreaRows.length ? validAreaRows.reduce((value, row) => value + row.production / (row.area as number), 0) / validAreaRows.length : null;
  const farmerIncome = filtered.some((row) => typeof row.farmer_income === "number") ? sum("farmer_income") : null;
  const water = filtered.some((row) => typeof row.water_used === "number") ? sum("water_used") : null;
  const weatherFields: (keyof Row)[] = ["rainfall", "temperature", "drought_index", "flood_events", "heatwave_days"];
  const weatherCount = weatherFields.filter((field) => filtered.some((row) => typeof row[field] === "number")).length;
  const value = (number: number | null, suffix = "") => number === null ? "Not available" : `${compact(number)}${suffix}`;
  return <div className="panel-stack"><div className="kpi-grid"><KpiCard label="Production growth" value={`${growth.toFixed(1)}%`} detail="First to latest available year" trend={growth} /><KpiCard label="Production concentration" value={`${concentration.toFixed(1)}%`} detail="Largest crop share" /><KpiCard label="Total production" value={`${compact(total)} t`} detail="Current filter context" /><KpiCard label="Profit" value={value(profit, " currency")} detail={profit === null ? "Requires revenue and costs" : "Revenue minus total costs"} /></div><section className="card target-card"><div><p className="eyebrow">DATA-SUPPORTED KPI REVIEW</p><h2>Financial, farmer, sustainability and weather indicators</h2><p>Each card uses only columns found in the active uploaded CSV. Missing inputs are clearly marked instead of estimated.</p></div><div className="extended-kpi-grid"><MetricStatus label="Revenue" value={value(revenue)} status={revenue === null ? "not_available" : "available"} detail="Revenue or quantity × price" /><MetricStatus label="Total costs" value={value(costs)} status={costs === null ? "not_available" : "available"} detail="Total cost column required" /><MetricStatus label="Yield" value={value(yieldValue, " t/ha")} status={yieldValue === null ? "not_available" : "available"} detail="Production and cultivated area" /><MetricStatus label="Farmer income" value={value(farmerIncome)} status={farmerIncome === null ? "not_available" : "available"} detail="Farmer income column" /><MetricStatus label="Water productivity" value={water ? `${(total / water).toFixed(3)} t/m³` : "Not available"} status={water ? "available" : "not_available"} detail="Production ÷ water used" /><MetricStatus label="Sustainability" value={filtered.some((row) => row.water_used !== undefined || row.carbon_emissions !== undefined) ? "Partial" : "Not available"} status={filtered.some((row) => row.water_used !== undefined || row.carbon_emissions !== undefined) ? "partial" : "not_available"} detail="Water, fertilizer, pesticide, emissions" /><MetricStatus label="Weather risk" value={weatherCount === weatherFields.length ? "Available" : weatherCount ? "Partial" : "Not available"} status={weatherCount === weatherFields.length ? "available" : weatherCount ? "partial" : "not_available"} detail={`${weatherCount}/${weatherFields.length} weather fields present`} /></div></section><section className="card target-card"><div><h2>Configure your benchmark</h2><p>Targets are user-configured and are not official industry standards.</p></div><label>Target annual growth <input type="number" value={targetGrowth} onChange={(e) => setTargetGrowth(Number(e.target.value))} /> %</label><div className={growth >= targetGrowth ? "benchmark good" : "benchmark warn"}>{growth >= targetGrowth ? "On track" : "Below target"} · observed growth is {Math.abs(growth - targetGrowth).toFixed(1)} points {growth >= targetGrowth ? "above" : "below"} your target.</div></section></div>;
}
function MetricStatus({ label, value, status, detail }: { label: string; value: string; status: "available" | "partial" | "not_available"; detail: string }) { return <div className="metric-status"><div><b>{label}</b><span className={`status-pill ${status}`}>{status === "available" ? "Available" : status === "partial" ? "Partial" : "Not available"}</span></div><strong>{value}</strong><small>{detail}</small></div>; }
function Recommendations({ filtered, growth, concentration, targetGrowth, crop }: { filtered: Row[]; growth: number; concentration: number; targetGrowth: number; crop?: string }) { const revenue = filtered.some((row) => typeof row.revenue === "number") ? filtered.reduce((sum, row) => sum + (row.revenue ?? 0), 0) : filtered.some((row) => typeof row.quantity_sold === "number" && typeof row.selling_price === "number") ? filtered.reduce((sum, row) => sum + (row.quantity_sold ?? 0) * (row.selling_price ?? 0), 0) : null; const costs = filtered.some((row) => typeof row.total_cost === "number") ? filtered.reduce((sum, row) => sum + (row.total_cost ?? 0), 0) : null; const profitMargin = revenue !== null && costs !== null && revenue !== 0 ? ((revenue - costs) / revenue) * 100 : null; const recs = [{ title: growth < targetGrowth ? "Investigate the growth gap" : "Protect the positive growth trend", body: `Observed growth is ${growth.toFixed(1)}% against your configurable ${targetGrowth}% benchmark. Segment the trend by crop and geography before acting.` }, { title: concentration > 60 ? "Review crop concentration risk" : "Maintain a diversified crop mix", body: `${concentration.toFixed(1)}% of selected production comes from ${crop ?? "the leading crop"}. Consider scenario analysis for a crop-specific shock.` }, { title: profitMargin === null ? "Add context before financial decisions" : "Monitor observed profit margin", body: profitMargin === null ? "Upload revenue and total cost fields to calculate profit from the active dataset." : `Calculated profit margin is ${profitMargin.toFixed(1)}% from the uploaded revenue and cost fields.`, }]; return <div className="recommendations"><div className="section-intro"><span className="section-icon"><Lightbulb size={20} /></span><div><p className="eyebrow">EVIDENCE-BASED ACTIONS</p><h2>Recommendations from your active data</h2><p>These rules recalculate whenever you upload a CSV or change the filters.</p></div></div>{recs.map((r, i) => <section className="card recommendation" key={r.title}><div className="rec-number">0{i + 1}</div><div><h2>{r.title}</h2><p>{r.body}</p><small>Rule-based · evidence linked · not a guarantee</small></div></section>)}</div>; }
function Methodology({ rows, filtered, source, lastUpdated }: { rows: Row[]; filtered: Row[]; source: string; lastUpdated: Date | null }) { const crops = new Set(filtered.map((r) => r.crop)).size; const geographies = new Set(filtered.map((r) => r.country)).size; const years = filtered.length ? `${Math.min(...filtered.map((r) => r.year))}–${Math.max(...filtered.map((r) => r.year))}` : "No years"; return <div className="method-grid"><div className="section-intro"><span className="section-icon"><BookOpen size={20} /></span><div><p className="eyebrow">TRANSPARENT ANALYTICS</p><h2>How this analysis was produced</h2><p>The methodology below is generated from the active dataset, not placeholder text.</p></div></div><section className="card"><p className="eyebrow">ACTIVE DATASET</p><h2>{source}</h2><div className="method-stat-grid"><b>{rows.length.toLocaleString()}<small>active rows</small></b><b>{filtered.length.toLocaleString()}<small>filtered rows</small></b><b>{crops}<small>crop categories</small></b><b>{geographies}<small>geographies</small></b></div><p>Coverage: <b>{years}</b>{lastUpdated && <> · loaded {lastUpdated.toLocaleTimeString()}</>}</p></section><section className="card"><p className="eyebrow">CALCULATIONS</p><h2>What is calculated</h2><ul><li>Trend: annual production totals from the active filter context.</li><li>Growth: change between the first and latest available year.</li><li>Concentration: leading crop divided by total production.</li><li>Forecast: five-year moving-average baseline.</li><li>Cleaning: schema, numeric, non-negative, and missing-value checks.</li></ul></section><section className="card"><p className="eyebrow">SOURCE & LIMITATIONS</p><h2>Interpret results carefully</h2><p>{source.startsWith("Uploaded") ? "This analysis uses your uploaded CSV. Confirm its provenance, units, collection period, and definitions before presenting it as official data." : "The default series is accessed through the Our World in Data Grapher and documents FAOSTAT as the underlying source. OWID is a third-party mirror, not the FAO application."}</p><p>Production observations alone cannot explain profitability, sustainability, yield, or causality. Forecasts are estimates, never guarantees.</p><a href="https://ourworldindata.org/agricultural-production" target="_blank">Read source documentation ↗</a></section></div>; }
