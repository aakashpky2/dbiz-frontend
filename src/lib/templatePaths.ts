// lib/templatePaths.ts
export type PathOption = { path: string; kind: "leaf" | "array" | "object" };

function isNumericKey(k: string) { return /^[0-9]+$/.test(k); }

export interface EnumOptions {
  includeContainers?: boolean;         // default: true (include arrays/objects)
  dictionaryKeys?: "wildcard" | "concrete" | "both"; // default: "wildcard"
  suppressStarTerminals?: boolean;     // default: true (hide "*" and ".*" endings)
  maxDepth?: number;                   // default: 8
}

function dedupePathOptions(arr: PathOption[]): PathOption[] {
  const seen = new Set<string>();
  const out: PathOption[] = [];
  for (const r of arr) if (!seen.has(r.path)) { seen.add(r.path); out.push(r); }
  const order = { leaf: 0, array: 1, object: 2 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.path.localeCompare(b.path));
}

const isPrim = (v: any) => v == null || typeof v !== "object";

function looksLikeArrayObject(obj: any) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every(isNumericKey);
}

/** trims arrays to one exemplar & collapses numeric-keyed objects into a single exemplar */
export function toSchemaShape(obj: any, depth = 0, maxDepth = 6): any {
  if (obj == null || typeof obj !== "object" || depth >= maxDepth) return obj ?? "";
  if (Array.isArray(obj)) {
    const first = obj.find((x: any) => x != null);
    return first ? [toSchemaShape(first, depth + 1, maxDepth)] : [];
  }
  const keys = Object.keys(obj);
  const numericOnly = keys.length > 0 && keys.every(isNumericKey);
  if (numericOnly) {
    const first = obj[keys[0]];
    return first ? [toSchemaShape(first, depth + 1, maxDepth)] : [];
  }
  const out: any = {};
  for (const k of keys) out[k] = toSchemaShape(obj[k], depth + 1, maxDepth);
  return out;
}

export function enumerateSchemaPaths(
  root: any,
  base = "",
  opts: EnumOptions = {}
): PathOption[] {
  const {
    includeContainers = true,
    dictionaryKeys = "wildcard",
    suppressStarTerminals = true,
    maxDepth = 8
  } = opts;

  function walk(node: any, cur: string, depth: number): PathOption[] {
    if (!node || depth > maxDepth) return [];
    const results: PathOption[] = [];

    // Arrays OR numeric-key objects → treat as array; descend once into exemplar
    if (Array.isArray(node) || looksLikeArrayObject(node)) {
      const here = cur ? `${cur}[]` : "[]";
      if (includeContainers) results.push({ path: here, kind: "array" });
      const exemplar = Array.isArray(node)
        ? node.find((x: any) => x != null)
        : node[Object.keys(node)[0]];
      if (exemplar && typeof exemplar === "object") results.push(...walk(exemplar, here, depth + 1));
      return results;
    }

    if (isPrim(node)) {
      if (cur) results.push({ path: cur, kind: "leaf" });
      return results;
    }

    // Object
    const keys = Object.keys(node);
    if (!keys.length) {
      if (includeContainers && cur) results.push({ path: cur, kind: "object" });
      return results;
    }

    const nonNumeric = keys.filter(k => !isNumericKey(k));
    const isDict = nonNumeric.length > 1; // treat as dictionary

    // Wildcard branch for dictionaries
    if (isDict && (dictionaryKeys === "wildcard" || dictionaryKeys === "both")) {
      const sample = node[nonNumeric[0]];
      const wildcardBase = cur ? `${cur}.*` : "*";
      if (includeContainers) results.push({ path: wildcardBase, kind: "object" });
      if (sample && typeof sample === "object") results.push(...walk(sample, wildcardBase, depth + 1));
    }

    // Concrete keys (only if not suppressing them)
    if (!isDict || dictionaryKeys !== "wildcard") {
      for (const k of nonNumeric) {
        const val = node[k];
        const here = cur ? `${cur}.${k}` : k;

        if (isPrim(val)) {
          results.push({ path: here, kind: "leaf" });
          continue;
        }

        if (Array.isArray(val) || looksLikeArrayObject(val)) {
          const arrTok = `${here}[]`;
          if (includeContainers) results.push({ path: arrTok, kind: "array" });
          const exemplar = Array.isArray(val) ? val.find(Boolean) : val[Object.keys(val)[0]];
          if (exemplar && typeof exemplar === "object") results.push(...walk(exemplar, arrTok, depth + 1));
          continue;
        }

        if (includeContainers) results.push({ path: here, kind: "object" });
        results.push(...walk(val, here, depth + 1));
      }
    }

    return results;
  }

  // enumerate & post-filter
  let out = dedupePathOptions(walk(root, base, 0));

  if (suppressStarTerminals) {
    out = out.filter(({ path, kind }) => {
      // drop plain "*" and any path ending with ".*"
      if (path === "*" || /(^|\.|\[\])\*$/.test(path)) return false;
      // also drop object wildcards like "roles.*.members[].*" (not useful in dropdown)
      if (/\.\*$/.test(path)) return false;
      // keep leaves always; for containers we already filtered the star-only ones
      return true;
    });
  }

  return out;
}

export function getByAdvancedPath(root: any, advancedPath: string): any {
  if (!advancedPath) return root;
  const tokens = tokenize(advancedPath); // split by dot but keep [] and *
  return resolveTokens(root, tokens);
}

function tokenize(p: string): string[] {
  // split by '.' but keep [] as its own token
  const raw = p.split(".");
  const tokens: string[] = [];
  for (const part of raw) {
    if (!part) continue;
    if (part.endsWith("[]")) {
      tokens.push(part.slice(0, -2)); // key
      tokens.push("[]");
    } else if (part === "*" || part.endsWith(".*")) {
      const key = part === "*" ? "*" : part.slice(0, -2);
      if (key) tokens.push(key);
      tokens.push("*");
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

function resolveTokens(curr: any, tokens: string[]): any {
  if (tokens.length === 0) return curr;
  const [head, ...rest] = tokens;

  if (head === "[]") {
    if (!Array.isArray(curr)) return undefined;
    // map each element through remaining tokens → flatten
    const mapped = curr.map(el => resolveTokens(el, rest));
    return flatten(mapped);
  }

  if (head === "*") {
    if (!curr || typeof curr !== "object" || Array.isArray(curr)) return undefined;
    // map each value through remaining tokens → flatten
    const vals = Object.values(curr);
    const mapped = vals.map(v => resolveTokens(v, rest));
    return flatten(mapped);
  }

  // normal key
  if (!curr || typeof curr !== "object") return undefined;
  return resolveTokens(curr[head], rest);
}

function flatten(arr: any[]): any[] {
  const out: any[] = [];
  for (const v of arr) {
    if (Array.isArray(v)) out.push(...v);
    else if (v !== undefined) out.push(v);
  }
  return out;
}
