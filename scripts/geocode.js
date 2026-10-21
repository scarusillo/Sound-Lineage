// Geocode artist origins ("City, State/Country") with the all-the-cities database (GeoNames, pop > 1000).
// Usage: node build/geocode.js data/artists.json > data/geo.json   (prints misses to stderr)
const fs = require("fs");
const cities = require("all-the-cities");
const US = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "washington, d.c.": "DC", "d.c.": "DC", dc: "DC" };
const ABBR = new Set(Object.values(US));
const C = { usa: "US", "united states": "US", us: "US", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB", uk: "GB", "united kingdom": "GB", ireland: "IE", canada: "CA", australia: "AU", "new zealand": "NZ", jamaica: "JM", trinidad: "TT", "trinidad and tobago": "TT", barbados: "BB", cuba: "CU", "puerto rico": "PR", mexico: "MX", brazil: "BR", argentina: "AR", colombia: "CO", chile: "CL", peru: "PE", venezuela: "VE", "dominican republic": "DO", panama: "PA", spain: "ES", portugal: "PT", france: "FR", germany: "DE", "west germany": "DE", italy: "IT", netherlands: "NL", belgium: "BE", sweden: "SE", norway: "NO", denmark: "DK", finland: "FI", iceland: "IS", switzerland: "CH", austria: "AT", poland: "PL", russia: "RU", ukraine: "UA", greece: "GR", turkey: "TR", israel: "IL", egypt: "EG", lebanon: "LB", morocco: "MA", algeria: "DZ", mali: "ML", senegal: "SN", nigeria: "NG", ghana: "GH", "south africa": "ZA", kenya: "KE", ethiopia: "ET", "democratic republic of the congo": "CD", congo: "CD", zimbabwe: "ZW", cameroon: "CM", benin: "BJ", "ivory coast": "CI", "côte d'ivoire": "CI", india: "IN", pakistan: "PK", bangladesh: "BD", japan: "JP", "south korea": "KR", korea: "KR", china: "CN", "hong kong": "HK", taiwan: "TW", philippines: "PH", indonesia: "ID", thailand: "TH", vietnam: "VN", iran: "IR", iraq: "IQ", "saudi arabia": "SA", "czech republic": "CZ", czechia: "CZ", hungary: "HU", romania: "RO", serbia: "RS", croatia: "HR", bulgaria: "BG", estonia: "EE", "cape verde": "CV", haiti: "HT", "the bahamas": "BS", bahamas: "BS", guyana: "GY", uruguay: "UY", ecuador: "EC", bolivia: "BO", paraguay: "PY", "costa rica": "CR", guatemala: "GT", "el salvador": "SV", honduras: "HN", nicaragua: "NI", tanzania: "TZ", uganda: "UG", angola: "AO", mozambique: "MZ", sudan: "SD", tunisia: "TN", syria: "SY", jordan: "JO", "united arab emirates": "AE", singapore: "SG", malaysia: "MY", "sri lanka": "LK", nepal: "NP", mongolia: "MN", luxembourg: "LU", slovenia: "SI", slovakia: "SK", lithuania: "LT", latvia: "LV", belarus: "BY", georgia_country: "GE", armenia: "AM", azerbaijan: "AZ", kazakhstan: "KZ", "faroe islands": "FO", greenland: "GL", "us virgin islands": "VI", "virgin islands": "VI", bermuda: "BM", martinique: "MQ", guadeloupe: "GP", "new caledonia": "NC" };
// neighbourhoods and places the database files under another name
const ALIAS = { "bronx": "New York City|US|NY", "the bronx": "New York City|US|NY", "south bronx": "New York City|US|NY", "brooklyn": "New York City|US|NY", "queens": "New York City|US|NY", "harlem": "New York City|US|NY", "manhattan": "New York City|US|NY", "staten island": "New York City|US|NY", "new york city": "New York City|US|NY", "nyc": "New York City|US|NY", "hollis": "New York City|US|NY", "jamaica, queens": "New York City|US|NY", "laurel canyon": "Los Angeles|US|CA", "south central los angeles": "Los Angeles|US|CA", "hollywood": "Los Angeles|US|CA", "watts": "Los Angeles|US|CA", "south side of chicago": "Chicago|US|IL", "west philadelphia": "Philadelphia|US|PA", "trenchtown": "Kingston|JM|", "trench town": "Kingston|JM|", "motown": "Detroit|US|MI", "east london": "London|GB|", "south london": "London|GB|", "north london": "London|GB|", "west london": "London|GB|", "tottenham": "London|GB|", "croydon": "London|GB|", "rio": "Rio de Janeiro|BR|", "são paulo": "São Paulo|BR|", "sao paulo": "São Paulo|BR|", "mexico city": "Mexico City|MX|", "washington, d.c.": "Washington|US|DC", "washington d.c.": "Washington|US|DC", "d.c.": "Washington|US|DC", "st. louis": "St. Louis|US|MO", "saint louis": "St. Louis|US|MO", "st. paul": "Saint Paul|US|MN", "new orleans": "New Orleans|US|LA", "seoul": "Seoul|KR|", "tokyo": "Tokyo|JP|", "lagos": "Lagos|NG|", "kyiv": "Kyiv|UA|" };
// small towns and regions the city database doesn't hold (pop < 1000 or not a city): lat, lon, label, country
const MANUAL = { "wimborne, england": [50.8, -1.98, "Wimborne", "GB"], "turkey, texas": [34.39, -100.9, "Turkey", "US"], "tanworth-in-arden, england": [52.33, -1.84, "Tanworth-in-Arden", "GB"], "somerton, st. james, jamaica": [18.43, -77.88, "Somerton", "JM"], "slab fork, west virginia": [37.68, -81.33, "Slab Fork", "US"], "saint michael, barbados": [13.1, -59.62, "Bridgetown", "BB"], "saint ann's bay, jamaica": [18.43, -77.2, "Saint Ann's Bay", "JM"], "rosine, kentucky": [37.45, -86.74, "Rosine", "US"], "rosewood, kentucky": [37.08, -87.05, "Rosewood", "US"], "orange county, california": [33.75, -117.87, "Orange County", "US"], "mooringsport, louisiana": [32.68, -93.96, "Mooringsport", "US"], "mcclure, virginia": [37.07, -82.38, "McClure", "US"], "maces spring, virginia": [36.63, -82.47, "Maces Spring", "US"], "liberchies, belgium": [50.5, 4.43, "Liberchies", "BE"], "lawrence county, kentucky": [38.11, -82.6, "Lawrence County", "US"], "kendal, hanover, jamaica": [18.42, -78.13, "Kendal", "JM"], "juazeiro, bahia, brazil": [-9.41, -40.5, "Juazeiro", "BR"], "isle of wight, england": [50.7, -1.29, "Isle of Wight", "GB"], "elkmont, alabama": [34.93, -86.97, "Elkmont", "US"], "dundas, canada": [43.27, -79.95, "Dundas", "CA"], "dorset, england": [50.71, -2.44, "Dorset", "GB"], "dockery plantation, mississippi": [33.7, -90.63, "Dockery Plantation", "US"], "deep gap, north carolina": [36.23, -81.51, "Deep Gap", "US"], "cwmaman, wales": [51.69, -3.43, "Cwmaman", "GB"], "coutchman, texas": [31.81, -96.43, "Coutchman", "US"], "cotton plant, arkansas": [35.0, -91.25, "Cotton Plant", "US"], "cornwall, england": [50.26, -5.05, "Cornwall", "GB"], "butcher hollow, kentucky": [37.88, -82.76, "Butcher Hollow", "US"], "brownie, kentucky": [37.24, -87.13, "Brownie", "US"], "bentonia, mississippi": [32.64, -90.37, "Bentonia", "US"], "baskin, louisiana": [32.26, -91.74, "Baskin", "US"], "abbott, texas": [31.88, -97.07, "Abbott", "US"], "long island, new york": [40.71, -73.62, "Long Island", "US"], "cologne, west germany": [50.94, 6.96, "Cologne", "DE"], "cologne, germany": [50.94, 6.96, "Cologne", "DE"], "gothenburg, sweden": [57.71, 11.97, "Gothenburg", "SE"], "ciudad juarez, mexico": [31.69, -106.42, "Ciudad Juárez", "MX"], "naucalpan, mexico": [19.48, -99.24, "Naucalpan", "MX"], "hope hull, alabama": [32.27, -86.36, "Hope Hull", "US"] };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const idx = new Map();
for (const c of cities) {
  for (const n of [c.name, ...(c.altName ? c.altName.split(",") : [])]) {
    const k = norm(n); if (!k) continue;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(c);
  }
}
function best(name, cc, admin) {
  let list = idx.get(norm(name)) || [];
  if (cc) list = list.filter((c) => c.country === cc);
  if (admin && cc === "US") { const l2 = list.filter((c) => c.adminCode === admin); if (l2.length) list = l2; }
  if (!list.length) return null;
  const c = list.sort((a, b) => b.population - a.population)[0];
  return { lat: +c.loc.coordinates[1].toFixed(3), lon: +c.loc.coordinates[0].toFixed(3), city: c.name, cc: c.country };
}
function geocode(origin) {
  if (!origin) return null;
  const o = norm(origin).replace(/^(near|outside|rural|born in|raised in)\s+/, "");
  if (MANUAL[o]) { const [lat, lon, city, cc] = MANUAL[o]; return { lat, lon, city, cc }; }
  if (/^new york, (new york|ny)$/.test(o)) return best("New York City", "US", "NY");
  if (ALIAS[o]) { const [n, cc, ad] = ALIAS[o].split("|"); return best(n, cc, ad); }
  const parts = o.split(",").map((s) => s.trim()).filter(Boolean);
  let cc = null, admin = null;
  const last = parts[parts.length - 1];
  if (parts.length > 1) {
    if (US[last]) { cc = "US"; admin = US[last]; }
    else if (ABBR.has(last.toUpperCase()) && last.length === 2) { cc = "US"; admin = last.toUpperCase(); }
    else if (C[last]) cc = C[last];
    if (parts.length > 2 && !cc && C[parts[parts.length - 1]]) cc = C[parts[parts.length - 1]];
    if (parts.length > 2 && cc === "US" && US[parts[1]]) admin = US[parts[1]];
  } else if (C[last]) return null; // a country only
  const first = parts[0];
  if (ALIAS[first]) { const [n, c2, ad] = ALIAS[first].split("|"); return best(n, c2, ad); }
  for (const cand of [first, first.replace(/^(east|west|north|south) /, ""), first.replace(/^st\.? /, "saint "), first.replace(/^saint /, "st. "), first.replace(/ city$/, "")]) {
    const r = best(cand, cc, admin); if (r) return r;
  }
  // try the middle part (e.g. "Hollis, Queens, New York")
  if (parts.length > 2) { for (const p of parts.slice(1, -1)) { const a = ALIAS[p]; if (a) { const [n, c2, ad] = a.split("|"); return best(n, c2, ad); } const r = best(p, cc, admin); if (r) return r; } }
  return null;
}
if (require.main === module) {
  const d = JSON.parse(fs.readFileSync(process.argv[2]));
  const out = {}; let miss = 0;
  for (const a of d.artists) {
    const g = geocode(a.origin);
    if (g) out[a.id] = [g.lat, g.lon, g.city, g.cc];
    else { miss++; process.stderr.write(`MISS ${a.id}: ${a.origin}\n`); }
  }
  process.stderr.write(`geocoded ${Object.keys(out).length}, missed ${miss}\n`);
  process.stdout.write(JSON.stringify(out));
}
module.exports = { geocode };
