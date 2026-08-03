"""
Deck Studio accounts, from the CLI.

Sign-in is email + password (2026-08-03, replacing magic links). Accounts are not
self-serve: only @oppr.ai addresses may exist at all, enforced by the database,
and an owner decides which of them actually do. The Accounts page in the app does
all of this too — this tool is the way in when nobody can sign in yet, which is
exactly the case that matters after a fresh deploy or a forgotten password.

Uses SUPABASE_SECRET_KEY, so it is server-side only and bypasses RLS.

    python tools\\manage-users.py list
    python tools\\manage-users.py add floris@oppr.ai --name "Floris Wyers" --role owner
    python tools\\manage-users.py password floris@oppr.ai
    python tools\\manage-users.py role colleague@oppr.ai editor
    python tools\\manage-users.py disable colleague@oppr.ai
    python tools\\manage-users.py enable colleague@oppr.ai

`add` and `password` generate a password unless you pass --password, and print it
once. There is no way to read it back afterwards: pass it on, then have the person
change it on the Accounts page.
"""
from __future__ import annotations

import argparse
import secrets
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from supa import Supa  # noqa: E402

ROLES = ("owner", "editor", "viewer")
DOMAIN = "@oppr.ai"

# No l/1/I/O/0: these get read out loud and typed by hand.
ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_password(n: int = 16) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def auth(sb: Supa, method: str, path: str, **kw):
    """Call the Auth admin API with the secret key."""
    r = requests.request(
        method,
        f"{sb.url}/auth/v1{path}",
        headers={
            "apikey": sb.key,
            "Authorization": f"Bearer {sb.key}",
            "Content-Type": "application/json",
        },
        timeout=30,
        **kw,
    )
    if not r.ok:
        detail = ""
        try:
            b = r.json()
            detail = b.get("msg") or b.get("error_description") or b.get("message") or b.get("error") or ""
        except Exception:
            detail = r.text[:300]
        if "restricted to " + DOMAIN.lstrip("@") in detail or DOMAIN in detail:
            detail = f"Only {DOMAIN} addresses can have an account."
        raise SystemExit(f"ERROR: {detail or f'{r.status_code} from Auth'}")
    return r.json() if r.content else {}


def revoke_invite(sb: Supa, email: str) -> None:
    """Leaving a live invitation behind after a failed create would be a
    standing permission nobody asked for."""
    try:
        requests.delete(
            f"{sb.rest}/invited_emails",
            headers={"apikey": sb.key, "Authorization": f"Bearer {sb.key}"},
            params={"email": f"eq.{email}"},
            timeout=30,
        )
    except Exception:
        pass  # the domain rule still refuses everything it refused before


def profile_for(sb: Supa, email: str) -> dict:
    rows = sb.select("profiles", {"email": f"eq.{email}", "select": "*"})
    if not rows:
        raise SystemExit(f"ERROR: no account for {email}. Add one with: manage-users.py add {email}")
    return rows[0]


def cmd_list(sb: Supa, _args) -> None:
    rows = sb.select("profiles", {"select": "*", "order": "created_at.asc"})
    if not rows:
        print("No accounts yet.")
        return
    w = max(len(r["email"]) for r in rows)
    print(f"{'EMAIL'.ljust(w)}  ROLE    ACCESS   LAST SEEN")
    for r in rows:
        access = "blocked" if r["disabled"] else "ok"
        seen = (r.get("last_seen_at") or "never")[:10]
        print(f"{r['email'].ljust(w)}  {r['role'].ljust(6)}  {access.ljust(7)}  {seen}")


def cmd_add(sb: Supa, args) -> None:
    email = args.email.strip().lower()
    if not email.endswith(DOMAIN):
        raise SystemExit(f"ERROR: only {DOMAIN} addresses can have an account.")
    if args.role not in ROLES:
        raise SystemExit(f"ERROR: role must be one of {', '.join(ROLES)}.")
    password = args.password or new_password()

    # The database refuses an uninvited address, so record the invitation first
    # and take it back if the account does not get created. Creating the account
    # consumes it, which is what makes an invitation single use.
    sb.upsert("invited_emails", {"email": email}, "email")
    try:
        # email_confirm: an owner running this IS the confirmation. Nothing in
        # this flow touches an inbox any more.
        user = auth(sb, "POST", "/admin/users", json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": args.name or ""},
        })
    except SystemExit:
        revoke_invite(sb, email)
        raise
    # A trigger on auth.users writes the profile row; role is ours to set.
    patch = {}
    if args.role != "editor":
        patch["role"] = args.role
    if args.name:
        patch["full_name"] = args.name
    if patch:
        sb.update("profiles", {"id": f"eq.{user['id']}"}, patch)

    print(f"Created {email} as {args.role}.")
    print(f"  password: {password}")
    print("  Pass this on, then have them change it on the Accounts page.")


def cmd_password(sb: Supa, args) -> None:
    p = profile_for(sb, args.email.strip().lower())
    password = args.password or new_password()
    auth(sb, "PUT", f"/admin/users/{p['id']}", json={"password": password})
    print(f"New password for {p['email']}:")
    print(f"  {password}")


def cmd_role(sb: Supa, args) -> None:
    if args.role not in ROLES:
        raise SystemExit(f"ERROR: role must be one of {', '.join(ROLES)}.")
    p = profile_for(sb, args.email.strip().lower())
    sb.update("profiles", {"id": f"eq.{p['id']}"}, {"role": args.role})
    print(f"{p['email']} is now {args.role}.")


def cmd_access(sb: Supa, args, disabled: bool) -> None:
    p = profile_for(sb, args.email.strip().lower())
    sb.update("profiles", {"id": f"eq.{p['id']}"}, {"disabled": disabled})
    print(f"{p['email']} {'can no longer sign in' if disabled else 'can sign in again'}.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Manage Deck Studio accounts.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="show every account")

    a = sub.add_parser("add", help="create an account with its first password")
    a.add_argument("email")
    a.add_argument("--name", default="")
    a.add_argument("--role", default="editor", choices=ROLES)
    a.add_argument("--password", default="", help="default: generated and printed")

    p = sub.add_parser("password", help="set a new password")
    p.add_argument("email")
    p.add_argument("--password", default="", help="default: generated and printed")

    r = sub.add_parser("role", help="change what someone may do")
    r.add_argument("email")
    r.add_argument("role", choices=ROLES)

    for name, help_text in (("disable", "block sign-in"), ("enable", "restore sign-in")):
        c = sub.add_parser(name, help=help_text)
        c.add_argument("email")

    args = ap.parse_args()
    sb = Supa()

    if args.cmd == "list":
        cmd_list(sb, args)
    elif args.cmd == "add":
        cmd_add(sb, args)
    elif args.cmd == "password":
        cmd_password(sb, args)
    elif args.cmd == "role":
        cmd_role(sb, args)
    elif args.cmd == "disable":
        cmd_access(sb, args, True)
    elif args.cmd == "enable":
        cmd_access(sb, args, False)


if __name__ == "__main__":
    main()
