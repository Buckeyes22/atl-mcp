---
description: "PostGIS patterns: geometry/geography choices, spatial indexing, and query boundary rules"
globs: ["db/**/*.sql", "migrations/**/*.sql", "src/**/*.ts", "app/**/*.py", "src/lib/maps/**/*.ts"]
alwaysApply: false
---

# PostGIS — Spatial Data Module

**Targets:** PostgreSQL + PostGIS
**Appended to base CLAUDE.md when spatial data is in use.**

---

## Spatial Modeling

1. Choose `geometry` versus `geography` intentionally. Do not mix them casually.
2. Record SRID decisions explicitly. Silent SRID mismatches cause incorrect distance and intersection logic.
3. Keep spatial columns named clearly and document whether they represent points, polygons, lines, or derived shapes.

## Query Rules

4. Use spatial indexes for proximity and intersection queries.
5. Avoid expensive full-table spatial scans when bounding boxes or prefilters can reduce the candidate set first.
6. Keep coordinate transforms explicit. If a query depends on transformation, the transform must be visible in reviewed SQL or query code.

## Application Boundaries

7. Convert spatial data into frontend-ready GeoJSON or typed map payloads in one reviewed adapter layer.
8. Do not push raw WKT/WKB handling into UI code or general business logic modules.

## Testing

9. Test spatial business rules with representative fixtures: proximity thresholds, containment, overlap, and edge conditions near boundaries.
