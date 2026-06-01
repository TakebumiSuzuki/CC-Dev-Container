/* ============================================================
   charts.js — Chart.js (v4) configurations
   All chart instances are kept in `charts` so main.js can
   resize them when a hidden tab becomes visible.
   ============================================================ */
(function () {
  "use strict";

  // ---- Shared palette (matches good / bad / neutral CSS semantics) ----
  var C = {
    navy:    "#1f3a5f",
    blue:    "#3b6fb0",
    blueSoft:"#9fc0e8",
    slate:   "#8190a6",
    slateSoft:"#c7d0de",
    good:    "#1a7f5a",
    bad:     "#b3402f",
    warn:    "#b5760f",
    teal:    "#2a9d8f",
    grid:    "rgba(31,58,95,0.07)",
    ink:     "#1c2733"
  };

  // ---- Global Chart.js defaults ----
  if (window.Chart) {
    Chart.defaults.font.family = '"Inter", system-ui, -apple-system, sans-serif';
    Chart.defaults.font.size = 14.5;
    Chart.defaults.color = "#5a6a80";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 9;
    Chart.defaults.plugins.legend.labels.padding = 18;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(20,40,68,0.94)";
    Chart.defaults.maintainAspectRatio = false;
  }

  var charts = {};
  function make(id, config) {
    var el = document.getElementById(id);
    if (!el) return;
    charts[id] = new Chart(el.getContext("2d"), config);
  }

  function pct(v) { return v + "%"; }
  function money(v) { return "$" + v + "M"; }

  // =========================================================
  // FINANCIALS
  // =========================================================

  // 1. Revenue & operating profit (bars) + margin (line, right axis)
  make("chartRevenue", {
    type: "bar",
    data: {
      labels: ["FY2023", "FY2024", "FY2025"],
      datasets: [
        { label: "Revenue ($M)", data: [33.4, 38.7, 43.7], backgroundColor: C.navy, borderRadius: 5, order: 2 },
        { label: "Operating Profit ($M)", data: [11.9, 13.8, 15.7], backgroundColor: C.blueSoft, borderRadius: 5, order: 2 },
        { label: "Operating Margin (%)", type: "line", data: [35.7, 35.6, 35.8], yAxisID: "y1",
          borderColor: C.good, backgroundColor: C.good, tension: .3, borderWidth: 2.5,
          pointRadius: 4, pointBackgroundColor: "#fff", pointBorderWidth: 2, order: 1 }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: "Revenue, Profit & Margin (FY2023–FY2025)", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) {
          var v = c.parsed.y;
          return c.dataset.label + ": " + (c.dataset.yAxisID === "y1" ? pct(v) : money(v));
        } } }
      },
      scales: {
        y:  { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: function (v) { return money(v); } }, title: { display: true, text: "$M" } },
        y1: { position: "right", min: 30, max: 40, grid: { drawOnChartArea: false }, ticks: { callback: function (v) { return pct(v); } }, title: { display: true, text: "Margin" } },
        x:  { grid: { display: false } }
      }
    }
  });

  // 2. Quarterly revenue (bars) + margin (line)
  make("chartQuarterly", {
    type: "bar",
    data: {
      labels: ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"],
      datasets: [
        { label: "Revenue ($M)", data: [9.8, 11.5, 10.7, 11.7], backgroundColor: C.blue, borderRadius: 5 },
        { label: "Margin (%)", type: "line", data: [37.3, 35.3, 35.6, 35.4], yAxisID: "y1",
          borderColor: C.warn, backgroundColor: C.warn, tension: .3, borderWidth: 2.5,
          pointRadius: 4, pointBackgroundColor: "#fff", pointBorderWidth: 2 }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: "FY2025 Quarterly Revenue & Margin", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) {
          return c.dataset.label + ": " + (c.dataset.yAxisID === "y1" ? pct(c.parsed.y) : money(c.parsed.y));
        } } }
      },
      scales: {
        y:  { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: function (v) { return money(v); } } },
        y1: { position: "right", min: 34, max: 38, grid: { drawOnChartArea: false }, ticks: { callback: function (v) { return pct(v); } } },
        x:  { grid: { display: false } }
      }
    }
  });

  // 3. Revenue by practice — FY2024 vs FY2025 (grouped bars)
  make("chartPractice", {
    type: "bar",
    data: {
      labels: [["Technology &", "Digital"], ["Strategy &", "Growth"], ["Operations", "Excellence"], ["Finance &", "Risk"], ["HR &", "People"]],
      datasets: [
        { label: "FY2024 ($M)", data: [10.9, 8.6, 7.7, 6.9, 4.6], backgroundColor: C.slateSoft, borderRadius: 4 },
        { label: "FY2025 ($M)", data: [12.3, 9.6, 8.7, 7.8, 5.2], backgroundColor: C.navy, borderRadius: 4 }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: "Revenue by Practice (FY2024 vs FY2025)", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + money(c.parsed.y); } } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: function (v) { return money(v); } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });

  // =========================================================
  // DELIVERY QUALITY — bubble: on-time (x) vs satisfaction (y), size = margin
  // =========================================================
  function bubble(label, onTime, sat, margin, color) {
    return { label: label, data: [{ x: onTime, y: sat, r: (margin - 24) * 2.1, margin: margin }],
      backgroundColor: color + "cc", borderColor: color, borderWidth: 1.5 };
  }
  make("chartDelivery", {
    type: "bubble",
    data: {
      datasets: [
        bubble("Operations Excellence", 100, 3.92, 29.8, C.good),
        bubble("Strategy & Growth", 50, 4.50, 27.1, C.blue),
        bubble("Technology & Digital", 43, 4.09, 31.6, C.navy),
        bubble("HR & People", 43, 4.44, 30.3, C.teal),
        bubble("Finance & Risk", 43, 3.91, 32.6, C.warn)
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: "On-Time Rate vs. Satisfaction by Practice", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) {
          var d = c.raw;
          return c.dataset.label + " — on-time " + pct(d.x) + ", satisfaction " + d.y + ", margin " + pct(d.margin);
        } } }
      },
      scales: {
        x: { min: 30, max: 110, grid: { color: C.grid }, title: { display: true, text: "On-Time Completion Rate" }, ticks: { callback: function (v) { return pct(v); } } },
        y: { min: 3.7, max: 4.7, grid: { color: C.grid }, title: { display: true, text: "Avg. Client Satisfaction (/5.0)" } }
      }
    }
  });

  // =========================================================
  // CLIENT HEALTH
  // =========================================================

  // 5. Retention 3-year (per-bar good/bad coloring)
  make("chartRetention", {
    type: "bar",
    data: {
      labels: ["FY2023", "FY2024", "FY2025"],
      datasets: [{ label: "Retention Rate", data: [93.3, 85.3, 89.3],
        backgroundColor: [C.good, C.bad, C.good], borderRadius: 5 }]
    },
    options: {
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Client Retention Rate", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) { return pct(c.parsed.y); } } }
      },
      scales: {
        y: { min: 80, max: 95, grid: { color: C.grid }, ticks: { callback: function (v) { return pct(v); } } },
        x: { grid: { display: false } }
      }
    }
  });

  // 6. Churn reasons (doughnut)
  make("chartChurn", {
    type: "doughnut",
    data: {
      labels: ["Pricing", "Competitor", "Budget", "Relationship", "Scope completion"],
      datasets: [{ data: [2, 2, 2, 1, 1],
        backgroundColor: [C.bad, C.warn, C.slate, C.blue, C.teal], borderColor: "#fff", borderWidth: 2 }]
    },
    options: {
      cutout: "58%",
      plugins: {
        legend: { position: "right" },
        title: { display: true, text: "FY2025 Churn Reasons (8 clients)", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 10 } },
        tooltip: { callbacks: { label: function (c) { return c.label + ": " + c.parsed + " client" + (c.parsed > 1 ? "s" : ""); } } }
      }
    }
  });

  // 7. NPS composition FY2024 vs FY2025 (stacked bars)
  make("chartNps", {
    type: "bar",
    data: {
      labels: ["FY2024", "FY2025"],
      datasets: [
        { label: "Promoters (≥70)", data: [32, 29], backgroundColor: C.good },
        { label: "Passives (50–69)", data: [30, 33], backgroundColor: C.slateSoft },
        { label: "Detractors (<50)", data: [50, 50], backgroundColor: C.bad }
      ]
    },
    options: {
      indexAxis: "y",
      plugins: {
        title: { display: true, text: "NPS Composition (n=112)", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + c.parsed.x + " (" + Math.round(c.parsed.x / 112 * 100) + "%)"; } } }
      },
      scales: {
        x: { stacked: true, max: 112, grid: { color: C.grid }, title: { display: true, text: "Respondents" } },
        y: { stacked: true, grid: { display: false } }
      }
    }
  });

  // =========================================================
  // PIPELINE
  // =========================================================

  // 8. Active project status (doughnut)
  make("chartStatus", {
    type: "doughnut",
    data: {
      labels: ["On track", "Ahead", "At risk", "On hold"],
      datasets: [{ data: [42, 7, 6, 3],
        backgroundColor: [C.good, C.teal, C.warn, C.slate], borderColor: "#fff", borderWidth: 2 }]
    },
    options: {
      cutout: "58%",
      plugins: {
        legend: { position: "right" },
        title: { display: true, text: "Active Project Status (58 projects)", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 10 } },
        tooltip: { callbacks: { label: function (c) { return c.label + ": " + c.parsed + " projects"; } } }
      }
    }
  });

  // 9. Contracted value by practice (horizontal bars)
  make("chartContracted", {
    type: "bar",
    data: {
      labels: ["HR & People", "Strategy & Growth", "Finance & Risk", "Technology & Digital", "Operations Excellence"],
      datasets: [{ label: "Contracted Value", data: [15.4, 12.2, 8.5, 6.4, 6.1], backgroundColor: C.navy, borderRadius: 4 }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Active Contracted Value by Practice", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } },
        tooltip: { callbacks: { label: function (c) { return money(c.parsed.x); } } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: function (v) { return money(v); } } },
        y: { grid: { display: false } }
      }
    }
  });

  // Expose a resize helper so main.js can refresh charts when a
  // previously-hidden tab is shown (charts laid out at 0px otherwise).
  window.resizeChartsIn = function (panel) {
    if (!panel) return;
    panel.querySelectorAll("canvas").forEach(function (cv) {
      var ch = charts[cv.id];
      if (ch) ch.resize();
    });
  };
})();
