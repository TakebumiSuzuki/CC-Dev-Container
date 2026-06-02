/* ============================================================
   main.js — tab navigation, keyboard nav, scroll-to-top.
   All three activation paths (click / keyboard / URL hash)
   funnel through a single activateTab() entry point.
   ============================================================ */
(function () {
  "use strict";

  var tabs   = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  var ids    = tabs.map(function (t) { return t.dataset.target; });
  var activeIndex = 0;

  // ---- Single entry point used by clicks, keyboard, and hash ----
  function activateTab(index) {
    index = Math.min(tabs.length - 1, Math.max(0, index)); // clamp (no wrap)
    activeIndex = index;
    var targetId = ids[index];

    tabs.forEach(function (t, i) {
      t.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    panels.forEach(function (p) {
      var on = p.id === targetId;
      p.classList.toggle("is-active", on);
      p.setAttribute("aria-hidden", on ? "false" : "true");
    });

    // Reflect in URL without adding history noise
    if (history.replaceState) history.replaceState(null, "", "#" + targetId);
    else location.hash = targetId;

    // Keep the active tab visible if the bar overflows horizontally
    // (block:"nearest" avoids any vertical page jump — the bar is sticky).
    tabs[index].scrollIntoView({ inline: "center", block: "nearest" });

    // Reset scroll for the freshly shown panel
    window.scrollTo({ top: 0, behavior: "auto" });

    // Charts in a previously hidden panel were laid out at 0px — refresh them.
    if (window.resizeChartsIn) {
      var panel = document.getElementById(targetId);
      // rAF lets the panel's display:block apply before measuring.
      requestAnimationFrame(function () { window.resizeChartsIn(panel); });
    }
  }

  // ---- Click ----
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { activateTab(i); });
  });

  // ---- Keyboard (←/→) ----
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    // Ignore when typing in a field (none here, but safe).
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    e.preventDefault();
    activateTab(activeIndex + (e.key === "ArrowRight" ? 1 : -1));
  });

  // ---- Scroll-to-top button ----
  var toTop = document.getElementById("toTop");
  function onScroll() {
    toTop.classList.toggle("is-visible", window.scrollY > 320);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---- Initial state from URL hash (deep-linking) ----
  var start = ids.indexOf((location.hash || "").replace("#", ""));
  activateTab(start >= 0 ? start : 0);
})();
