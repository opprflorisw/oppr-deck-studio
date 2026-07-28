# gcp service selection

`wayfinder:research` · child of `../MAP.md` · unassigned

## Question

Which Google Cloud services, concretely, and what do they cost?

A shortlist with reasoning, not a survey:

- **Compute**: Cloud Run service for the app, Cloud Run jobs for builds. Anything
  that argues for GKE or Compute Engine instead.
- **Database**: Cloud SQL Postgres versus Firestore, judged against the real access
  pattern - a few hundred records, heavy read, rare write, needs ordering and text
  search over titles.
- **Storage**: GCS storage classes and lifecycle rules for PDFs and images.
- **Auth**: Identity-Aware Proxy versus Firebase Auth versus Workspace SSO, for a
  handful of named users on an oppr.ai domain.
- **Secrets**: Secret Manager for `GEMINI_API_KEY`, with per-user attribution.
- A monthly cost estimate for a team of about five at low traffic.

AFK.
