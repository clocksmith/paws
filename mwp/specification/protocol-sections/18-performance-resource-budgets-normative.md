## 18. Performance & Resource Budgets (Normative)

**MWP-18.1.1:** Widget bundles **MUST NOT** exceed 500KB gzipped; widgets **SHOULD** stay within 100KB for core logic.

**MWP-18.1.2:** Initial render time **MUST NOT** exceed 500ms on reference hardware (2 vCPU, 4GB RAM, slow 3G network throttling); widgets **SHOULD** render within 200ms.

**MWP-18.1.3:** Steady-state memory usage per widget **MUST NOT** exceed 20MB; implementations **SHOULD** target ≤10MB to leave headroom for multiple concurrent widgets.

**MWP-18.1.4:** Widgets that implement `getResourceUsage()` **MUST** report metrics in bytes and milliseconds as defined in Section 17.6.5.

**MWP-18.1.5:** Hosts **MUST** enforce these budgets before distributing widgets through marketplaces or enterprise catalogs and **MAY** refuse activation if any limit is breached.

---
