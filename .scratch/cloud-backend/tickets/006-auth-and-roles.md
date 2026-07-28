# auth and roles

`wayfinder:grilling` · child of `../MAP.md` · unassigned

## Question

Who can do what, and how do they sign in?

Users are the Oppr team. Define the identity provider (Workspace SSO is the obvious
candidate on an oppr.ai domain), the role set, and what each role may do. At
minimum distinguish viewing, composing drafts, triggering a build, publishing,
renaming, archiving and deleting.

Deleting matters specifically: the app can now permanently remove a built output,
and in a team that has to be a permission and an audit entry, not just a typed
confirmation.

Also decide whether every mutation is attributed - who renamed this, who deleted
that - and where that trail lives.
