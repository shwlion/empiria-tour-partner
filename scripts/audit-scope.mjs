#!/usr/bin/env node
/**
 * The boundary test for this application.
 *
 * Every other repository in the project can be wrong in ways that produce a bug
 * report. This one can be wrong in a way that shows one partner another
 * partner's customers, and that is not a bug report — it is a phone call from a
 * lawyer. So the boundary is checked mechanically rather than by remembering.
 *
 * Three rules, each of which a reasonable-looking change has already broken:
 *
 *  1. A read that touches an ownership root — `packages`, `departures`,
 *     `bookings` — applies a partner filter somewhere in the same function.
 *     `listDeparturesForPackage` once did not, and was safe only because of the
 *     order its one caller happened to call it in, which is not safety but luck
 *     with a shelf life. Child tables reached by a parent id (itinerary days by
 *     package, travellers by booking) need no filter of their own: getting the
 *     parent id already required a scoped read.
 *
 *  2. Every server action reaches ownership before it writes — by re-reading
 *     `partner_id` and comparing it to the signed-in user, by delegating to a
 *     local helper that does, or by stamping `partner_id: user.id` on an
 *     insert. `deleteDepartureAction` once did none of these, and two guessed
 *     uuids would have deleted somebody else's departure.
 *
 *  3. No route under `app/dashboard` renders without `requirePartner()`.
 *
 * House style, not enforced here because the existing call sites predate it:
 * new functions in `lib/console/` take `partnerId` as their first parameter.
 * A scope in first position is harder to leave off than one at the end.
 *
 * Run: node scripts/audit-scope.mjs   (exit 1 on any finding)
 *
 * Static, so it is defeatable by anyone determined to defeat it. That is fine.
 * It is here to catch the ordinary mistake made at five o'clock, which is the
 * one that actually happens.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: a file: URL percent-encodes, and this repo
// lives under a directory whose name contains a space. `.pathname` hands back
// "Empiria%20Tours" and every readdir under it fails, which the audit reports
// as a crash rather than as a finding — a guard that cannot run is a guard
// that is not there.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const findings = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Functions with their parameter list and body.
 *
 * The body starts at the first `{` that is not inside a type annotation —
 * `Promise<{ id: string }[]>` is a return type, not a function body, and
 * mistaking the two silently shrinks every check to nothing.
 */
function functionsIn(source, { exportedOnly = true } = {}) {
  const out = [];
  const re = exportedOnly
    ? /export\s+async\s+function\s+(\w+)\s*\(/g
    : /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    let i = re.lastIndex;
    let depth = 1;
    while (i < source.length && depth > 0) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') depth--;
      i++;
    }
    const params = source.slice(re.lastIndex, i - 1);

    let angle = 0;
    let open = -1;
    for (let k = i; k < source.length; k++) {
      const c = source[k];
      if (c === '<') angle++;
      else if (c === '>') angle = Math.max(0, angle - 1);
      else if (c === '{' && angle === 0) { open = k; break; }
      else if (c === ';' && angle === 0) break; // an overload signature, no body
    }
    if (open === -1) continue;

    let j = open + 1;
    depth = 1;
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') depth--;
      j++;
    }
    out.push({ name: m[1], params, body: source.slice(open, j) });
  }
  return out;
}

/** The tables ownership hangs off. Everything else is reached through one. */
const ROOTS = ['packages', 'departures', 'bookings', 'blog_posts'];
const readsRoot = (body) =>
  ROOTS.some((t) => new RegExp(`\\.from\\(\\s*['"]${t}['"]\\s*\\)`).test(body));

/**
 * The columns a row's owner is named in. `packages` and everything hanging off
 * it use `partner_id`; `blog_posts` uses `author_id`, because a post has an
 * author rather than a supplier. One list, so adding a table with a third name
 * is one edit here rather than a rule that quietly stops covering it.
 */
const OWNER = ['partner_id', 'author_id'];
const ownerAlternation = OWNER.join('|');

/** A partner filter applied to the query, or checked against the result. */
const appliesScope = (body) =>
  new RegExp(`\\.eq\\(\\s*['"][\\w.]*(${ownerAlternation})['"]\\s*,\\s*\\w+\\s*\\)`).test(body) ||
  new RegExp(`(${ownerAlternation})\\s*!==\\s*\\w+`).test(body);

/**
 * A read that is global on purpose.
 *
 * Some reads genuinely span every partner: slug uniqueness, for one, because
 * /blog/<slug> is a single namespace shared with Empiria and scoping it would
 * mint two posts that fight over one URL. Those exist, so the audit needs a way
 * to say so — but a bare allow-list of function names would let the next
 * exemption in silently. The marker has to carry a reason, it has to sit in the
 * body where a reviewer reading the function sees it, and it is greppable:
 *
 *   grep -rn 'audit-scope: global read' lib/
 *
 * tells you the complete set of places the boundary is deliberately not applied.
 */
const exempt = (body) => /audit-scope:\s*global read\s*[\u2014-]/.test(body);

// ── Rule 1: reads of an ownership root are scoped ───────────────────────────
for (const file of walk(join(ROOT, 'lib'))) {
  if (!file.endsWith('.ts')) continue;
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const fn of functionsIn(source)) {
    if (!readsRoot(fn.body)) continue;
    if (exempt(fn.body)) continue;
    if (!appliesScope(fn.body)) {
      findings.push(
        `${rel}: ${fn.name}() reads ${ROOTS.join('/')} without applying an ` +
          `owner filter (${OWNER.join(' or ')}). Protection by call order is not ` +
          `protection. If the read is global on purpose, say so in the body with ` +
          `"audit-scope: global read — <why>".`
      );
    }
  }
}

// ── Rule 2: every server action reaches ownership before it writes ──────────
const WRITE = /\.\s*(insert|update|upsert|delete)\s*\(/;
/**
 * Three shapes count as reaching ownership: comparing the owner column to the
 * caller, stamping it on an insert, or pinning it in the query itself. The
 * third is the strongest — it is in the WHERE clause of the write, so a row
 * belonging to somebody else is not merely rejected afterwards, it is never
 * matched — and it was the shape the audit used to miss.
 */
const ownsInline = (body) =>
  new RegExp(`(${ownerAlternation})\\s*!==\\s*user\\.id`).test(body) ||
  new RegExp(`(${ownerAlternation}):\\s*user\\.id`).test(body) ||
  new RegExp(`\\.eq\\(\\s*['"](${ownerAlternation})['"]\\s*,\\s*user\\.id\\s*\\)`).test(body);

for (const file of walk(join(ROOT, 'app'))) {
  if (!file.endsWith('actions.ts')) continue;
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');

  // A local helper counts as a delegate only if it does the check itself. The
  // name is not trusted — the body is read.
  const delegates = functionsIn(source, { exportedOnly: false })
    .filter((f) => ownsInline(f.body) && /requirePartner\(/.test(f.body))
    .map((f) => f.name);
  const viaDelegate = (body) =>
    delegates.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(body));

  for (const fn of functionsIn(source)) {
    if (!WRITE.test(fn.body)) continue;
    if (!/requirePartner\(|partnerScope\(/.test(fn.body) && !viaDelegate(fn.body)) {
      findings.push(`${rel}: ${fn.name}() writes without establishing who is signed in.`);
      continue;
    }
    if (!ownsInline(fn.body) && !viaDelegate(fn.body)) {
      findings.push(
        `${rel}: ${fn.name}() writes but never checks the row belongs to this partner.`
      );
    }
  }
}

// ── Rule 3: no dashboard route renders without the guard ────────────────────
for (const file of walk(join(ROOT, 'app', 'dashboard'))) {
  if (!/\/(page|route)\.tsx?$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  if (!/requirePartner\(|partnerScope\(/.test(source)) {
    findings.push(`${relative(ROOT, file)}: renders without calling requirePartner().`);
  }
}

if (findings.length === 0) {
  console.log('✓ scope audit clean');
  process.exit(0);
}
console.error(`✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}:\n`);
for (const f of findings) console.error('  • ' + f);
process.exit(1);
