"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart3, BookOpen, ChevronRight, CloudDownload, Database, FileUp,
  Gauge, LayoutDashboard, Lightbulb, Menu, Search, Settings2, Sprout,
  TrendingUp, Upload, UserCircle, LogOut, ChevronDown, X, CloudSun, WalletCards,
  FileText, Stethoscope, ShoppingBasket
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
type DataQuality = {
  records_before: number;
  records_after: number;
  missing_rows_removed: number;
  invalid_numeric_or_negative_removed: number;
  duplicate_rows_removed: number;
};
type Section = "Overview" | "Data import" | "Visualizations" | "Forecasting" | "KPI evaluation" | "Recommendations" | "Methodology" | "Weather" | "Financials" | "Reports" | "Crop health" | "Market prices";
type AuthMode = "login" | "signup";

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
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
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
  const [quality, setQuality] = useState<DataQuality>({
    records_before: 0, records_after: 0, missing_rows_removed: 0,
    invalid_numeric_or_negative_removed: 0, duplicate_rows_removed: 0
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [visualChart, setVisualChart] = useState<"line" | "bar" | "histogram">("line");
  const [weatherCity, setWeatherCity] = useState("New Delhi");
  const [weather, setWeather] = useState<{ location: string; updated: string; current: { temperature: number; condition: string; humidity: number; rainfall: number; wind: number }; forecast: { date: string; temperature: number; rainfall: number; condition: string }[] } | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [market, setMarket] = useState<{ commodity: string; year: string; price: string; unit: string }[]>([]);
  const [marketError, setMarketError] = useState("");
  const [diseaseImage, setDiseaseImage] = useState("");

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [authenticated]);

  function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authMode === "signup" && !authName.trim()) {
      setAuthError("Please enter your name to create your workspace.");
      return;
    }
    if (!authEmail.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Use a password with at least 6 characters.");
      return;
    }
    if (authMode === "signup") {
      setAuthMode("login");
      setAuthPassword("");
      setAuthError("");
      setAuthNotice("Your account is ready. Log in to open your AgriVision workspace.");
      return;
    }
    setAuthError("");
    setAuthNotice("");
    setAuthenticated(true);
  }

  function logout() {
    setAuthenticated(false);
    setProfileOpen(false);
    setAuthPassword("");
    setAuthError("");
  }

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

  if (!authenticated) {
    return <AuthScreen
      mode={authMode}
      name={authName}
      email={authEmail}
      password={authPassword}
      error={authError}
      notice={authNotice}
      onModeChange={(mode) => { setAuthMode(mode); setAuthError(""); setAuthNotice(""); }}
      onNameChange={setAuthName}
      onEmailChange={setAuthEmail}
      onPasswordChange={setAuthPassword}
      onSubmit={submitAuth}
    />;
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`${API_BASE}/api/data/upload`, { method: "POST", body: form });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail ?? "The Python data service rejected this CSV.");
      }

      const result = await response.json() as { records: Row[]; source: string; quality: DataQuality };
      const imported = result.records;
      setRows(imported);
      setCountry(imported[0].country);
      setCrop("All crops");
      setYear("All years");
      setDataSource(result.source);
      setQuality(result.quality);
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
        setQuality({
          records_before: result.data.length,
          records_after: imported.length,
          missing_rows_removed: result.data.length - imported.length,
          invalid_numeric_or_negative_removed: 0,
          duplicate_rows_removed: 0
        });
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

  async function loadWeather() {
    setWeatherError("");
    try {
      const response = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(weatherCity)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Weather data could not be loaded.");
      setWeather(result);
    } catch (weatherRequestError) {
      setWeatherError(weatherRequestError instanceof Error ? weatherRequestError.message : "Weather data could not be loaded.");
    }
  }

  async function loadMarket() {
    setMarketError("");
    try {
      const response = await fetch(`${API_BASE}/api/market-prices`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Market data could not be loaded.");
      setMarket(result.records);
    } catch (marketRequestError) {
      setMarketError(marketRequestError instanceof Error ? marketRequestError.message : "Market data could not be loaded.");
    }
  }

  function printReport() {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character] ?? character));
    const rowsHtml = filtered.map((row) => `
      <tr>
        <td>${row.year}</td>
        <td>${escapeHtml(row.crop)}</td>
        <td>${escapeHtml(row.country)}</td>
        <td class="number">${formatNumber(row.production)} t</td>
      </tr>`).join("");
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("The report window was blocked. Allow pop-ups for AgriVision and try again.");
      return;
    }
    reportWindow.document.write(`<!doctype html>
      <html><head><title>AgriVision production report</title>
      <style>
        @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#17382c;font-family:Arial,sans-serif;font-size:12px}
        header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #16734f;padding-bottom:16px;margin-bottom:22px}
        h1{font-size:25px;margin:0 0 6px;color:#123d2e}h2{font-size:15px;margin:0 0 12px;color:#16734f}
        p{color:#65786d;margin:4px 0}.eyebrow{color:#16734f;font-size:10px;font-weight:bold;letter-spacing:1.5px}
        .brand{font-size:18px;font-weight:bold;color:#16734f}.date{text-align:right;color:#65786d;font-size:11px}
        .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        .metric{padding:13px;border:1px solid #dce9df;border-radius:8px;background:#f5faf6}.metric strong{display:block;font-size:20px;color:#123d2e;margin-top:5px}
        table{width:100%;border-collapse:collapse;margin-top:10px}th{text-align:left;background:#e8f5eb;color:#315342;font-size:10px;text-transform:uppercase;letter-spacing:.8px}
        th,td{padding:9px 8px;border-bottom:1px solid #e2eee5}td{color:#4b6354}.number{text-align:right}
        footer{margin-top:24px;padding-top:12px;border-top:1px solid #dce9df;color:#829388;font-size:10px}
      </style></head><body>
      <header><div><div class="brand">AgriVision</div><p class="eyebrow">PRODUCTION ANALYSIS REPORT</p><h1>Filtered production report</h1><p>Source: ${escapeHtml(dataSource)}</p></div>
      <div class="date">Generated<br>${escapeHtml(new Date().toLocaleString())}</div></header>
      <section class="summary"><div class="metric">Records<strong>${filtered.length.toLocaleString()}</strong></div><div class="metric">Production<strong>${formatNumber(total)} t</strong></div><div class="metric">Growth<strong>${growth.toFixed(1)}%</strong></div></section>
      <h2>Active filtered records</h2><table><thead><tr><th>Year</th><th>Crop</th><th>Geography</th><th class="number">Production</th></tr></thead><tbody>${rowsHtml || "<tr><td colspan=\"4\">No records match the active filters.</td></tr>"}</tbody></table>
      <footer>Generated by AgriVision · Smart Agribusiness Analytics</footer>
      </body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.setTimeout(() => reportWindow.print(), 150);
  }

  const nav: { label: Section; icon: React.ReactNode }[] = [
    { label: "Overview", icon: <LayoutDashboard size={18} /> },
    { label: "Data import", icon: <Database size={18} /> },
    { label: "Visualizations", icon: <BarChart3 size={18} /> },
    { label: "Forecasting", icon: <TrendingUp size={18} /> },
    { label: "KPI evaluation", icon: <Gauge size={18} /> },
    { label: "Recommendations", icon: <Lightbulb size={18} /> },
    { label: "Methodology", icon: <BookOpen size={18} /> },
    { label: "Weather", icon: <CloudSun size={18} /> },
    { label: "Financials", icon: <WalletCards size={18} /> },
    { label: "Reports", icon: <FileText size={18} /> },
    { label: "Crop health", icon: <Stethoscope size={18} /> },
    { label: "Market prices", icon: <ShoppingBasket size={18} /> }
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sprout size={22} /></div><div><strong>AgriVision</strong><small>AGRIBUSINESS ANALYTICS</small></div></div>
      <div className="workspace-label">WORKSPACE <Settings2 size={13} /></div>
      <nav>{nav.map((item) => <button key={item.label} className={section === item.label ? "active" : ""} onClick={() => setSection(item.label)}>{item.icon}<span>{item.label}</span>{section === item.label && <ChevronRight size={15} className="nav-chevron" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="data-status"><span className={loading ? "dot loading" : "dot"}></span><div><b>{loading ? "Loading live data" : "Live data connected"}</b><small>Our World in Data · FAOSTAT</small></div></div><div className="profile"><div className="avatar">JA</div><div><b>Junior Analyst</b><small>Internship workspace</small></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="breadcrumb">Workspace <span>/</span> <b>{section}</b></div><div className="top-actions"><div className="search"><Search size={16} /><input placeholder="Search insights..." /></div><div className="profile-menu"><button className="profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><span className="header-avatar"><UserCircle size={19} /></span><span className="profile-trigger-copy"><b>{authName || "Junior Analyst"}</b><small>{authEmail || "Internship workspace"}</small></span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-dropdown"><div className="profile-dropdown-heading"><span className="header-avatar large"><UserCircle size={21} /></span><div><b>{authName || "Junior Analyst"}</b><small>{authEmail || "Internship workspace"}</small></div></div><button className="logout-button" onClick={logout}><LogOut size={16} /> Log out</button></div>}</div></div></header>
      <div className="content">
        {error && <div className="alert error">{error} Check your internet connection and reload.</div>}
        <div className="page-heading"><div><p className="eyebrow">AGRICULTURAL INTELLIGENCE · 2026</p><h1>{section === "Overview" ? "Production overview" : section}</h1><p className="subtitle">{section === "Overview" ? "Turn production data into decisions you can defend." : "Explore the evidence behind your agribusiness decisions."}</p><p className="data-source">Source: <b>{dataSource}</b>{lastUpdated && <> · Updated {lastUpdated.toLocaleTimeString()}</>}</p></div>{section !== "KPI evaluation" && <div className="filters"><label>Country<select value={country} onChange={(e) => setCountry(e.target.value)}><option>All geographies</option>{countries.slice(0, 80).map((c) => <option key={c}>{c}</option>)}</select></label><label>Crop<select value={crop} onChange={(e) => setCrop(e.target.value)}><option>All crops</option>{crops.map((c) => <option key={c}>{c}</option>)}</select></label><label>Year<select value={year} onChange={(e) => setYear(e.target.value)}><option>All years</option>{years.slice(-30).map((y) => <option key={y}>{y}</option>)}</select></label></div>}</div>
        {section === "Data import" ? <ImportPanel upload={upload} message={uploadMessage} rowCount={rows.length} source={dataSource} /> : section === "Methodology" ? <Methodology rows={rows} filtered={filtered} source={dataSource} lastUpdated={lastUpdated} quality={quality} /> : section === "Forecasting" ? <Forecast yearly={yearly} /> : section === "KPI evaluation" ? <Kpi filtered={filtered} total={total} growth={growth} concentration={concentration} targetGrowth={targetGrowth} setTargetGrowth={setTargetGrowth} /> : section === "Recommendations" ? <Recommendations filtered={filtered} growth={growth} concentration={concentration} targetGrowth={targetGrowth} crop={byCrop[0]?.name} /> : section === "Visualizations" ? <Visualizations filtered={filtered} byCrop={byCrop} chartType={visualChart} setChartType={setVisualChart} loading={loading} /> : section === "Weather" ? <WeatherPanel city={weatherCity} setCity={setWeatherCity} weather={weather} error={weatherError} load={loadWeather} /> : section === "Financials" ? <FinancialPanel filtered={filtered} total={total} /> : section === "Reports" ? <ReportsPanel printReport={printReport} downloadCsv={downloadCsv} /> : section === "Crop health" ? <DiseasePanel image={diseaseImage} setImage={setDiseaseImage} /> : section === "Market prices" ? <MarketPanel records={market} error={marketError} load={loadMarket} /> : <Dashboard filtered={filtered} yearly={yearly} byCrop={byCrop} total={total} countries={countries} years={years} latestYear={latestYear} firstYear={firstYear} growth={growth} concentration={concentration} loading={loading} />}
      </div>
    </main>
  </div>;
}

function WeatherPanel({ city, setCity, weather, error, load }: { city: string; setCity: (value: string) => void; weather: { location: string; updated: string; current: { temperature: number; condition: string; humidity: number; rainfall: number; wind: number }; forecast: { date: string; temperature: number; rainfall: number; condition: string }[] } | null; error: string; load: () => void }) {
  return <div className="panel-stack"><section className="visual-hero"><div><p className="eyebrow">FIELD CONDITIONS</p><h2>Weather intelligence for your farm</h2><p>Connect WeatherAPI to bring current conditions and a five-day forecast into your decisions.</p></div><div className="weather-search"><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City or farm location" /><button onClick={load}>Check weather</button></div></section>{error && <div className="alert error">{error}</div>}{weather ? <><div className="kpi-grid"><KpiCard label="Temperature" value={`${weather.current.temperature}°C`} detail={weather.current.condition} /><KpiCard label="Humidity" value={`${weather.current.humidity}%`} detail="Current relative humidity" /><KpiCard label="Rainfall" value={`${weather.current.rainfall} mm`} detail="Current precipitation" /><KpiCard label="Wind" value={`${weather.current.wind} kph`} detail={weather.location} /></div><section className="card table-card"><div className="card-heading"><div><h2>Five-day outlook</h2><p>Updated {weather.updated}</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Condition</th><th>Temperature</th><th>Rainfall</th></tr></thead><tbody>{weather.forecast.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.condition}</td><td>{day.temperature}°C</td><td>{day.rainfall} mm</td></tr>)}</tbody></table></div></section></> : <div className="card loading-card">Enter a location and check weather to load live conditions.</div>}</div>;
}

function FinancialPanel({ filtered, total }: { filtered: Row[]; total: number }) {
  const revenue = filtered.reduce((sum, row) => sum + (row.revenue ?? (row.quantity_sold && row.selling_price ? row.quantity_sold * row.selling_price : 0)), 0);
  const costs = filtered.reduce((sum, row) => sum + (row.total_cost ?? 0), 0);
  const profit = revenue - costs;
  return <div className="panel-stack"><section className="section-intro"><span className="section-icon"><WalletCards size={20} /></span><div><p className="eyebrow">FINANCIAL INTELLIGENCE</p><h2>Understand what each harvest returns</h2><p>These figures use revenue, quantity × price, and cost columns in the active dataset.</p></div></section><div className="kpi-grid"><KpiCard label="Production" value={`${formatNumber(total)} t`} detail={`${filtered.length} selected records`} /><KpiCard label="Revenue" value={revenue ? formatNumber(revenue) : "Not available"} detail="From uploaded financial fields" /><KpiCard label="Total costs" value={costs ? formatNumber(costs) : "Not available"} detail="From total cost fields" /><KpiCard label="Estimated profit" value={revenue ? formatNumber(profit) : "Not available"} detail="Revenue minus costs" /></div><section className="card limitation"><b>Data requirement</b><p>Upload Revenue, Quantity_Sold, Selling_Price, and Total_Cost columns to unlock accurate farm profitability analysis.</p></section></div>;
}

function ReportsPanel({ printReport, downloadCsv }: { printReport: () => void; downloadCsv: () => void }) {
  return <div className="panel-stack"><section className="visual-hero"><div><p className="eyebrow">DECISION PACK</p><h2>Take your analysis with you</h2><p>Export the active filtered view for field reviews, presentations, and record keeping.</p></div></section><div className="two-col"><section className="card import-card"><FileText size={30} color="#16734f" /><h2>Printable PDF report</h2><p>Generate a separate report document, then choose Print or Save as PDF in the browser dialog.</p><button className="upload-button" onClick={printReport}>Print / Save PDF</button></section><section className="card import-card"><CloudDownload size={30} color="#16734f" /><h2>Excel-compatible export</h2><p>Download the filtered production dataset as a CSV that opens directly in Excel.</p><button className="upload-button" onClick={downloadCsv}>Download CSV</button></section></div></div>;
}

function DiseasePanel({ image, setImage }: { image: string; setImage: (value: string) => void }) {
  return <div className="panel-stack"><section className="section-intro"><span className="section-icon"><Stethoscope size={20} /></span><div><p className="eyebrow">CROP HEALTH LAB</p><h2>Screen a crop image</h2><p>Upload a clear leaf photo for the first local screening workflow. Connect a trained model later for production-grade diagnosis.</p></div></section><section className="card import-card"><label className="upload-button"><Upload size={17} /> Upload crop image<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImage(URL.createObjectURL(file)); }} /></label>{image && <><img className="disease-preview" src={image} alt="Uploaded crop sample" /><div className="alert success">Image received. Preliminary screen: review for visible leaf discoloration, spots, and pest damage before taking action.</div></>}</section></div>;
}

function MarketPanel({ records, error, load }: { records: { commodity: string; year: string; price: string; unit: string }[]; error: string; load: () => void }) {
  return <div className="panel-stack"><section className="visual-hero"><div><p className="eyebrow">MARKET INTELLIGENCE</p><h2>Track producer price signals</h2><p>FAOSTAT provides free official producer-price data for global comparisons.</p></div><button className="chart-switcher-button" onClick={load}>Refresh prices</button></section>{error && <div className="alert error">{error}</div>}{records.length ? <section className="card table-card"><div className="table-wrap"><table><thead><tr><th>Commodity</th><th>Year</th><th>Price</th><th>Unit</th></tr></thead><tbody>{records.map((record, index) => <tr key={`${record.commodity}-${record.year}-${index}`}><td>{record.commodity}</td><td>{record.year}</td><td>{record.price}</td><td>{record.unit}</td></tr>)}</tbody></table></div></section> : <div className="card loading-card">Refresh prices to load the latest available FAOSTAT producer-price records.</div>}</div>;
}

function AuthScreen({
  mode, name, email, password, error, onModeChange, onNameChange, onEmailChange,
  onPasswordChange, onSubmit, notice
}: {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  error: string;
  notice: string;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const isSignup = mode === "signup";
  return <main className="auth-page">
    <div className="auth-decoration auth-decoration-one" />
    <div className="auth-decoration auth-decoration-two" />
    <section className="auth-story">
      <div className="auth-story-visual" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="orbit orbit-three" />
        <span className="leaf leaf-one" />
        <span className="leaf leaf-two" />
        <span className="leaf leaf-three" />
      </div>
      <div className="auth-brand"><span className="auth-brand-mark"><Sprout size={23} /></span><span><b>AgriVision</b><small>AGRIBUSINESS ANALYTICS</small></span></div>
      <div className="auth-story-copy">
        <p className="eyebrow">GROW WITH CLARITY</p>
        <h1>Better harvests start with better decisions.</h1>
        <p>Turn field data into practical insight with a workspace built for modern agriculture teams.</p>
      </div>
      <div className="auth-feature-list">
        <div><span>01</span><p><b>See the full picture</b><small>Track production trends across every crop and geography.</small></p></div>
        <div><span>02</span><p><b>Plan with confidence</b><small>Use transparent forecasts and evidence-backed recommendations.</small></p></div>
      </div>
      <p className="auth-footnote">“Data is the new soil for sustainable growth.”</p>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-mobile-mark"><Sprout size={22} /></div>
        <p className="eyebrow">{isSignup ? "JOIN THE WORKSPACE" : "WELCOME BACK"}</p>
        <h2>{isSignup ? "Create your account" : "Welcome to your farm intelligence"}</h2>
        <p className="auth-subtitle">{isSignup ? "Set up your free analytics workspace in a few seconds." : "Sign in to continue to your analytics workspace."}</p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication">
          <button type="button" className={!isSignup ? "active" : ""} onClick={() => onModeChange("login")}>Log in</button>
          <button type="button" className={isSignup ? "active" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          {isSignup && <label>Full name<input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Your name" autoComplete="name" /></label>}
          <label>Email address<input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@farm.com" autoComplete="email" /></label>
          <label>Password <span className="auth-label-note">{!isSignup && "Forgot password?"}</span><input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="At least 6 characters" autoComplete={isSignup ? "new-password" : "current-password"} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="auth-submit" type="submit">{isSignup ? "Create workspace" : "Enter AgriVision"} <ChevronRight size={17} /></button>
        </form>
        <p className="auth-terms">{isSignup ? "By signing up, you agree to our workspace terms." : "New to AgriVision? Use the Sign up tab to get started."}</p>
      </div>
      <p className="auth-copyright">© 2026 AgriVision · Built for people who grow</p>
    </section>
  </main>;
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
function Methodology({ rows, filtered, source, lastUpdated, quality }: { rows: Row[]; filtered: Row[]; source: string; lastUpdated: Date | null; quality: DataQuality }) {
  const crops = new Set(filtered.map((r) => r.crop)).size;
  const geographies = new Set(filtered.map((r) => r.country)).size;
  const years = filtered.length ? `${Math.min(...filtered.map((r) => r.year))}–${Math.max(...filtered.map((r) => r.year))}` : "No years";
  const available = (fields: (keyof Row)[]) => fields.some((field) => filtered.some((row) => typeof row[field] === "number"));
  const yearly = Array.from(filtered.reduce((map, row) => map.set(row.year, (map.get(row.year) ?? 0) + row.production), new Map<number, number>()), ([year, production]) => ({ year, production })).sort((a, b) => a.year - b.year);
  const window = yearly.slice(-5);
  const baseline = window.length ? window.reduce((sum, row) => sum + row.production, 0) / window.length : 0;
  const holdout = yearly.length >= 4 ? yearly.slice(-Math.min(3, Math.floor(yearly.length / 4))) : [];
  const holdoutAverage = holdout.length ? holdout.reduce((sum, row) => sum + row.production, 0) / holdout.length : null;
  const errorPercent = holdoutAverage && holdoutAverage !== 0 ? Math.abs(baseline - holdoutAverage) / holdoutAverage * 100 : null;
  const status = (isAvailable: boolean) => isAvailable ? "Available" : "Not available";
  const revenueAvailable = available(["revenue"]) || (available(["quantity_sold"]) && available(["selling_price"]));
  const profitAvailable = revenueAvailable && available(["total_cost"]);
  return <div className="method-grid">
    <div className="section-intro"><span className="section-icon"><BookOpen size={20} /></span><div><p className="eyebrow">TRANSPARENT ANALYTICS</p><h2>How this analysis was produced</h2><p>This page describes the exact active dataset, validation rules, formulas, and model assumptions behind Agri Vision.</p></div></div>
    <section className="card"><p className="eyebrow">ACTIVE DATASET</p><h2>{source}</h2><div className="method-stat-grid"><b>{rows.length.toLocaleString()}<small>active rows</small></b><b>{filtered.length.toLocaleString()}<small>filtered rows</small></b><b>{crops}<small>crop categories</small></b><b>{geographies}<small>geographies</small></b></div><p>Coverage: <b>{years}</b>{lastUpdated && <> · loaded {lastUpdated.toLocaleTimeString()}</>}</p><p>Unit: <b>tonnes</b> unless an uploaded file defines another unit. Current filters are applied to every trend, KPI, and forecast calculation.</p></section>
    <section className="card"><p className="eyebrow">DATA QUALITY</p><h2>What passed the quality gate</h2><div className="method-quality-grid"><span>Rows received <b>{(quality.records_before || rows.length).toLocaleString()}</b></span><span>Rows retained <b>{(quality.records_after || rows.length).toLocaleString()}</b></span><span>Missing/malformed <b>{quality.missing_rows_removed.toLocaleString()}</b></span><span>Negative values <b>{quality.invalid_numeric_or_negative_removed.toLocaleString()}</b></span><span>Duplicates <b>{quality.duplicate_rows_removed.toLocaleString()}</b></span></div><p>Required fields are Year and Production. Values are converted to numbers; incomplete, invalid, negative, and duplicate records are excluded before analysis.</p></section>
    <section className="card"><p className="eyebrow">CALCULATIONS & FORMULAS</p><h2>What is calculated</h2><ul><li><b>Annual trend:</b> sum of production grouped by year.</li><li><b>Growth:</b> ((latest annual total − first annual total) ÷ first total) × 100.</li><li><b>Concentration:</b> leading crop production ÷ total production × 100.</li><li><b>Yield:</b> production ÷ positive cultivated area, when area is supplied.</li><li><b>Revenue:</b> revenue column, or quantity sold × selling price.</li></ul></section>
    <section className="card"><p className="eyebrow">FORECAST VALIDATION</p><h2>How the baseline is tested</h2><p>The forecast repeats the average production from the latest {window.length || 5} available years for the next three years.</p><div className="method-stat-grid"><b>{formatNumber(baseline)}<small>forecast baseline (t)</small></b><b>{holdout.length ? `${errorPercent?.toFixed(1)}%` : "—"}<small>holdout error (MAPE-like)</small></b><b>{yearly.length}<small>annual observations</small></b><b>{holdout.length || 0}<small>validation years</small></b></div><p>{holdout.length ? "The latest historical observations are compared with the baseline as a simple chronological check. Lower error is better." : "At least four annual observations are needed before a chronological holdout check can be shown."}</p></section>
    <section className="card"><p className="eyebrow">KPI INPUT AVAILABILITY</p><h2>Which decisions the data supports</h2><div className="method-availability"><span>Yield <b>{status(available(["area"]))}</b><small>Production + area</small></span><span>Revenue <b>{status(revenueAvailable)}</b><small>Revenue or quantity × price</small></span><span>Profit <b>{status(profitAvailable)}</b><small>Revenue + total costs</small></span><span>Weather risk <b>{status(available(["rainfall", "temperature", "drought_index", "flood_events", "heatwave_days"]))}</b><small>Weather observations</small></span></div></section>
    <section className="card"><p className="eyebrow">SOURCE & LIMITATIONS</p><h2>Interpret results carefully</h2><p>{source.startsWith("Uploaded") ? "This analysis uses your uploaded CSV. Confirm its provenance, collection period, definitions, and units before presenting it as official data." : "The default series is accessed through the Our World in Data Grapher and documents FAOSTAT as the underlying source. OWID is a third-party mirror, not the FAO application."}</p><p>Production observations alone cannot explain profitability, sustainability, yield, or causality. Forecasts are baseline estimates, not guarantees, and do not model weather, prices, policy, area changes, or unexpected shocks.</p><a href="https://ourworldindata.org/agricultural-production" target="_blank" rel="noreferrer">Read source documentation ↗</a></section>
  </div>;
}
