/* ============================================================
   charts.js — Chart.js (v4) configurations  [SCAFFOLD]
   ------------------------------------------------------------
   Keep the shared defaults, the `C` palette, the make() helper,
   and the resizeChartsIn() export AS-IS. Replace the example
   make(...) calls below with charts built from the report's
   own markdown tables. Every chart's canvas id must match a
   <canvas id="..."> in index.html.

   Pin the Chart.js CDN version in index.html to a version you
   verified from a primary source (jsDelivr / chartjs.org) —
   do not guess it from memory.
   ============================================================ */
(function () {
  "use strict";

  // ---- Shared palette. Use semantic colors so "good vs bad" reads instantly. ----
  var C = {
    navy:     "#1f3a5f",
    blue:     "#3b6fb0",
    blueSoft: "#9fc0e8",
    slate:    "#8190a6",
    slateSoft:"#c7d0de",
    good:     "#1a7f5a",   // improvement / positive
    bad:      "#b3402f",   // decline / risk
    warn:     "#b5760f",   // caution
    teal:     "#2a9d8f",
    grid:     "rgba(31,58,95,0.07)",
    ink:      "#1c2733"
  };

  // ---- Global Chart.js defaults (font matches the page's Inter scale) ----
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
    if (!el) return;                       // canvas not on the page — skip safely
    charts[id] = new Chart(el.getContext("2d"), config);
  }

  // Small formatters — adapt units to the report (%, $M, count, ...).
  function pct(v)   { return v + "%"; }
  function money(v) { return "$" + v + "M"; }

  /* ============================================================
     EXAMPLE CHARTS — delete these and build your own from the
     report's tables. They illustrate the common shapes:
     ============================================================ */

  // (A) Combo: bars on the left axis + a line (e.g. a rate/margin) on a
  //     second right axis. Good for "value over time + a ratio".
  make("chartCombo", {
    type: "bar",
    data: {
      labels: ["FY1", "FY2", "FY3"],
      datasets: [
        { label: "Value ($M)", data: [33.4, 38.7, 43.7], backgroundColor: C.navy, borderRadius: 5 },
        { label: "Rate (%)", type: "line", data: [35.7, 35.6, 35.8], yAxisID: "y1",
          borderColor: C.good, backgroundColor: C.good, tension: .3, borderWidth: 2.5,
          pointRadius: 4, pointBackgroundColor: "#fff", pointBorderWidth: 2 }
      ]
    },
    options: {
      plugins: { title: { display: true, text: "Example combo chart", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } } },
      scales: {
        y:  { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: function (v) { return money(v); } } },
        y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { callback: function (v) { return pct(v); } } },
        x:  { grid: { display: false } }
      }
    }
  });

  // (B) Grouped bars: compare two series across categories (e.g. last yr vs this yr).
  //     Multi-line category labels are ARRAYS, not "\n" strings.
  make("chartGrouped", {
    type: "bar",
    data: {
      labels: [["Cat", "A"], ["Cat", "B"], ["Cat", "C"]],
      datasets: [
        { label: "Prior", data: [10.9, 8.6, 7.7], backgroundColor: C.slateSoft, borderRadius: 4 },
        { label: "Current", data: [12.3, 9.6, 8.7], backgroundColor: C.navy, borderRadius: 4 }
      ]
    },
    options: {
      plugins: { title: { display: true, text: "Example grouped bars", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } } },
      scales: { y: { beginAtZero: true, grid: { color: C.grid } }, x: { grid: { display: false } } }
    }
  });

  // (C) Doughnut: parts of a whole (e.g. reasons, status mix).
  make("chartDonut", {
    type: "doughnut",
    data: {
      labels: ["On track", "At risk", "On hold"],
      datasets: [{ data: [42, 6, 3], backgroundColor: [C.good, C.warn, C.slate], borderColor: "#fff", borderWidth: 2 }]
    },
    options: {
      cutout: "58%",
      plugins: { legend: { position: "right" }, title: { display: true, text: "Example doughnut", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 10 } } }
    }
  });

  // (D) Horizontal bars: rank categories by a single value (indexAxis: "y").
  make("chartHBar", {
    type: "bar",
    data: {
      labels: ["Item A", "Item B", "Item C"],
      datasets: [{ label: "Value", data: [15.4, 12.2, 8.5], backgroundColor: C.navy, borderRadius: 4 }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false }, title: { display: true, text: "Example horizontal bars", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } } },
      scales: { x: { beginAtZero: true, grid: { color: C.grid } }, y: { grid: { display: false } } }
    }
  });

  // (E) Stacked bars: composition across a few groups (indexAxis "y" = horizontal stack).
  make("chartStacked", {
    type: "bar",
    data: {
      labels: ["Year 1", "Year 2"],
      datasets: [
        { label: "Good", data: [32, 29], backgroundColor: C.good },
        { label: "Neutral", data: [30, 33], backgroundColor: C.slateSoft },
        { label: "Bad", data: [50, 50], backgroundColor: C.bad }
      ]
    },
    options: {
      indexAxis: "y",
      plugins: { title: { display: true, text: "Example stacked bars", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } } },
      scales: { x: { stacked: true, grid: { color: C.grid } }, y: { stacked: true, grid: { display: false } } }
    }
  });

  // (F) Bubble: two metrics (x, y) + a third encoded as size (r). One dataset per
  //     point gives each its own legend color. r is in pixels — scale a real metric.
  function bubble(label, x, y, sizeMetric, color) {
    return { label: label, data: [{ x: x, y: y, r: (sizeMetric - 24) * 2.1, meta: sizeMetric }],
      backgroundColor: color + "cc", borderColor: color, borderWidth: 1.5 };
  }
  make("chartBubble", {
    type: "bubble",
    data: { datasets: [
      bubble("A", 100, 3.92, 29.8, C.good),
      bubble("B", 50, 4.50, 27.1, C.blue),
      bubble("C", 43, 4.09, 31.6, C.navy)
    ] },
    options: {
      plugins: { title: { display: true, text: "Example bubble", font: { size: 16, weight: "700" }, color: C.ink, padding: { bottom: 14 } } },
      scales: { x: { grid: { color: C.grid } }, y: { grid: { color: C.grid } } }
    }
  });

  /* ============================================================
     KEEP THIS EXPORT. main.js calls it to re-lay-out charts when
     a previously hidden tab becomes visible (canvases in a
     display:none panel measure as 0px until shown).
     ============================================================ */
  window.resizeChartsIn = function (panel) {
    if (!panel) return;
    panel.querySelectorAll("canvas").forEach(function (cv) {
      var ch = charts[cv.id];
      if (ch) ch.resize();
    });
  };
})();
