---
target: measurement-import workflows
total_score: 35
p0_count: 0
p1_count: 1
timestamp: 2026-06-21T19-20-10Z
slug: src-features-measurement-import-workflows
---
# Critique — Measure/Import/Onboarding/Classroom/Students workflows

Total 35/40 (Good upper). Detector clean [].

Heuristics: status 4, match 4, control 3, consistency 3, prevention 4, recognition 4, flexibility 3, aesthetic 3, recovery 4, help 3.

Anti-patterns: not AI slop; detector []. Micro-tell: .ctx-label uppercase/tracking.

Priority issues:
- [P1] Overwrite spoken two ways (manual "บันทึกทับ" vs excel "อัปเดตทับ" vs differing done-screens); reassurance about data-not-lost inconsistent. Fix: unify overwrite vocab + one reassurance line. /impeccable clarify
- [P2] Whole-room-already-measured = wall of amber per-row tags, no room-level summary. Fix: room banner + demote tags. /impeccable layout+clarify
- [P2] Room-select status pill stretches full column width (reads as bar). Fix: width:fit-content. /impeccable layout
- [P2] Import preview raw <table>+inline styles diverge from .mrow/.panel; iPad portrait scroll. /impeccable adapt
- [P3] .ctx-label uppercase/tracking micro-tell. /impeccable typeset

Persona: Jordan—"บันทึกทับ" reads destructive, needs reassurance. Riley—measure import doesn't flag intra-file dup IDs (student import does). Casey—preview table horizontal scroll portrait.

Minor: stacked amber tags noise; no record-screen room-level reassurance; intra-file measure dup unwarned.
