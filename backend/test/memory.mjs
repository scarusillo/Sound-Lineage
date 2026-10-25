// In-memory stand-in for dynamo.mjs, same interface, for tests.
export function memoryStore() {
  const items = new Map(), k = (PK, SK) => PK + "\u0000" + SK;
  return {
    items,
    async get(PK, SK) { return structuredClone(items.get(k(PK, SK)) || null); },
    async put(item) { items.set(k(item.PK, item.SK), structuredClone(item)); },
    async del(PK, SK) { items.delete(k(PK, SK)); },
    async query(pk, prefix, { index, limit = 100, desc = false } = {}) {
      const [P, S] = index ? ["GSI1PK", "GSI1SK"] : ["PK", "SK"];
      let r = [...items.values()].filter((i) => i[P] === pk && String(i[S] ?? "").startsWith(prefix || "")).sort((a, b) => String(a[S]).localeCompare(String(b[S])));
      if (desc) r.reverse();
      return structuredClone(r.slice(0, limit));
    },
    async batchDocs(pks) { return pks.map((PK) => items.get(k(PK, "PROFILE"))?.doc).filter(Boolean).map((d) => structuredClone(d)); },
  };
}
