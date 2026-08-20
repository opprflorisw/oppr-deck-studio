// Fake backend env for the UNIT suite, imported before any lib module so it
// wins the env() cache. Two reasons it exists:
//
// 1. CI has no .env and no backend, and the unit suite must pass on a fresh
//    clone — that is the whole point of the fast lane. Without this,
//    mcpauth's protected-resource test failed only on CI, because only the
//    developer machine had a SUPABASE_URL for it to read.
// 2. A unit test should never be ABLE to reach the real backend. Locally the
//    .env file supplies real values; pointing process.env (which env() prefers)
//    at a host that does not exist means a unit test that forgets to mock its
//    fetch fails loudly instead of quietly querying production.
//
// The integration suite does not import this — reaching the real backend is
// its job.
process.env.SUPABASE_URL ||= "https://unit-tests.supabase.invalid";
process.env.SUPABASE_SECRET_KEY ||= "sb_secret_unit_tests_fake";
process.env.SUPABASE_ANON_KEY ||= "sb_publishable_unit_tests_fake";
