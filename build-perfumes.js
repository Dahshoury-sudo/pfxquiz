/**
 * build-perfumes.js
 * One-time script: reads Products.xlsx and generates perfumes.js
 * with pre-computed tags (scent, occasion, season) and extracted notes.
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// 80+ Note Dictionary: note → categories
// ─────────────────────────────────────────────
const NOTE_DICTIONARY = {
  // ── WOODY ──
  "cedar":        { scent: ["woody"], season: ["fall","winter"] },
  "cedarwood":    { scent: ["woody"], season: ["fall","winter"] },
  "sandalwood":   { scent: ["woody"], season: ["fall","winter"] },
  "vetiver":      { scent: ["woody"], season: ["fall","winter"] },
  "patchouli":    { scent: ["woody","oriental"], season: ["fall","winter"] },
  "oud":          { scent: ["woody","oriental"], season: ["fall","winter"] },
  "agarwood":     { scent: ["woody","oriental"], season: ["fall","winter"] },
  "guaiac":       { scent: ["woody"], season: ["fall","winter"] },
  "teak":         { scent: ["woody"], season: ["fall","winter"] },
  "driftwood":    { scent: ["woody"], season: ["summer","fall"] },
  "oakmoss":      { scent: ["woody"], season: ["fall","winter"] },
  "oak":          { scent: ["woody"], season: ["fall","winter"] },
  "birch":        { scent: ["woody"], season: ["fall","winter"] },
  "cypress":      { scent: ["woody","fresh"], season: ["fall","spring"] },
  "wood":         { scent: ["woody"], season: ["fall","winter"] },
  "woods":        { scent: ["woody"], season: ["fall","winter"] },
  "woody":        { scent: ["woody"], season: ["fall","winter"] },

  // ── ORIENTAL ──
  "amber":        { scent: ["oriental"], season: ["fall","winter"] },
  "ambergris":    { scent: ["oriental"], season: ["fall","winter"] },
  "ambroxan":     { scent: ["oriental"], season: ["fall","winter"] },
  "incense":      { scent: ["oriental"], season: ["fall","winter"] },
  "olibanum":     { scent: ["oriental"], season: ["fall","winter"] },
  "resin":        { scent: ["oriental"], season: ["fall","winter"] },
  "labdanum":     { scent: ["oriental"], season: ["fall","winter"] },
  "balsam":       { scent: ["oriental"], season: ["fall","winter"] },
  "balsamic":     { scent: ["oriental"], season: ["fall","winter"] },
  "benzoin":      { scent: ["oriental"], season: ["fall","winter"] },
  "myrrh":        { scent: ["oriental"], season: ["fall","winter"] },
  "oriental":     { scent: ["oriental"], season: ["fall","winter"] },
  "saffron":      { scent: ["oriental","spicy"], season: ["fall","winter"] },
  "cypriol":      { scent: ["oriental","woody"], season: ["fall","winter"] },

  // ── SPICY ──
  "cinnamon":     { scent: ["spicy","oriental"], season: ["fall","winter"] },
  "cardamom":     { scent: ["spicy"], season: ["fall","winter"] },
  "pepper":       { scent: ["spicy"], season: ["fall","winter"] },
  "pink pepper":  { scent: ["spicy"], season: ["fall","spring"] },
  "black pepper": { scent: ["spicy"], season: ["fall","winter"] },
  "clove":        { scent: ["spicy","oriental"], season: ["fall","winter"] },
  "nutmeg":       { scent: ["spicy"], season: ["fall","winter"] },
  "cumin":        { scent: ["spicy"], season: ["fall","winter"] },
  "caraway":      { scent: ["spicy"], season: ["fall","winter"] },
  "ginger":       { scent: ["spicy","fresh"], season: ["fall","winter"] },
  "spicy":        { scent: ["spicy"], season: ["fall","winter"] },
  "spice":        { scent: ["spicy"], season: ["fall","winter"] },
  "spices":       { scent: ["spicy"], season: ["fall","winter"] },

  // ── FLORAL ──
  "rose":         { scent: ["floral"], season: ["spring","fall"] },
  "jasmine":      { scent: ["floral"], season: ["spring","summer"] },
  "iris":         { scent: ["floral"], season: ["spring"] },
  "orris":        { scent: ["floral"], season: ["spring"] },
  "tuberose":     { scent: ["floral"], season: ["summer","spring"] },
  "lily":         { scent: ["floral"], season: ["spring","summer"] },
  "violet":       { scent: ["floral"], season: ["spring"] },
  "geranium":     { scent: ["floral"], season: ["spring","summer"] },
  "orange blossom": { scent: ["floral","citrus"], season: ["spring","summer"] },
  "neroli":       { scent: ["floral","citrus"], season: ["spring","summer"] },
  "magnolia":     { scent: ["floral"], season: ["spring"] },
  "peony":        { scent: ["floral"], season: ["spring","summer"] },
  "ylang":        { scent: ["floral","oriental"], season: ["spring","summer"] },
  "floral":       { scent: ["floral"], season: ["spring","summer"] },
  "flower":       { scent: ["floral"], season: ["spring","summer"] },
  "florals":      { scent: ["floral"], season: ["spring","summer"] },
  "hibiscus":     { scent: ["floral"], season: ["spring","summer"] },
  "gardenia":     { scent: ["floral"], season: ["spring","summer"] },
  "freesia":      { scent: ["floral"], season: ["spring"] },
  "lavender":     { scent: ["floral","fresh"], season: ["spring","summer"] },
  "heliotrope":   { scent: ["floral","gourmand"], season: ["spring"] },

  // ── CITRUS ──
  "bergamot":     { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "lemon":        { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "grapefruit":   { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "orange":       { scent: ["citrus"], season: ["spring","summer"] },
  "lime":         { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "mandarin":     { scent: ["citrus"], season: ["spring","summer"] },
  "citron":       { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "citrus":       { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "yuzu":         { scent: ["citrus","fresh"], season: ["spring","summer"] },
  "tangerine":    { scent: ["citrus"], season: ["spring","summer"] },
  "petitgrain":   { scent: ["citrus","fresh"], season: ["spring","summer"] },

  // ── FRESH / AQUATIC ──
  "aqua":         { scent: ["fresh"], season: ["summer","spring"] },
  "aquatic":      { scent: ["fresh"], season: ["summer","spring"] },
  "marine":       { scent: ["fresh"], season: ["summer","spring"] },
  "sea":          { scent: ["fresh"], season: ["summer"] },
  "ocean":        { scent: ["fresh"], season: ["summer"] },
  "water":        { scent: ["fresh"], season: ["summer","spring"] },
  "seaweed":      { scent: ["fresh"], season: ["summer"] },
  "calone":       { scent: ["fresh"], season: ["summer"] },
  "ozone":        { scent: ["fresh"], season: ["summer","spring"] },
  "fresh":        { scent: ["fresh"], season: ["spring","summer"] },
  "crisp":        { scent: ["fresh"], season: ["spring","summer"] },
  "clean":        { scent: ["fresh"], season: ["spring","summer"] },
  "green":        { scent: ["fresh"], season: ["spring","summer"] },
  "mint":         { scent: ["fresh"], season: ["summer","spring"] },
  "apple":        { scent: ["fresh","fruity"], season: ["spring","summer"] },
  "pear":         { scent: ["fresh","fruity"], season: ["spring","summer"] },
  "tea":          { scent: ["fresh"], season: ["spring","summer"] },
  "galbanum":     { scent: ["fresh"], season: ["spring"] },
  "hedione":      { scent: ["fresh"], season: ["spring","summer"] },
  "salt":         { scent: ["fresh"], season: ["summer"] },
  "salty":        { scent: ["fresh"], season: ["summer"] },

  // ── GOURMAND ──
  "vanilla":      { scent: ["gourmand","oriental"], season: ["fall","winter"] },
  "tonka":        { scent: ["gourmand","oriental"], season: ["fall","winter"] },
  "chocolate":    { scent: ["gourmand"], season: ["fall","winter"] },
  "caramel":      { scent: ["gourmand"], season: ["fall","winter"] },
  "praline":      { scent: ["gourmand"], season: ["fall","winter"] },
  "toffee":       { scent: ["gourmand"], season: ["fall","winter"] },
  "honey":        { scent: ["gourmand"], season: ["fall","spring"] },
  "coffee":       { scent: ["gourmand"], season: ["fall","winter"] },
  "cocoa":        { scent: ["gourmand"], season: ["fall","winter"] },
  "almond":       { scent: ["gourmand"], season: ["fall","winter"] },
  "coconut":      { scent: ["gourmand","fresh"], season: ["summer"] },
  "sweet":        { scent: ["gourmand"], season: ["fall","winter"] },
  "sugar":        { scent: ["gourmand"], season: ["fall","winter"] },
  "rum":          { scent: ["gourmand","oriental"], season: ["fall","winter"] },
  "cognac":       { scent: ["gourmand"], season: ["fall","winter"] },
  "fig":          { scent: ["gourmand","fresh"], season: ["summer","fall"] },
  "dates":        { scent: ["gourmand"], season: ["fall","winter"] },

  // ── MUSKY ──
  "musk":         { scent: ["musky"], season: ["spring","summer","fall","winter"] },
  "white musk":   { scent: ["musky"], season: ["spring","summer"] },
  "ambrette":     { scent: ["musky"], season: ["spring","summer"] },
  "cashmeran":    { scent: ["musky","woody"], season: ["fall","winter"] },
  "cashmere":     { scent: ["musky"], season: ["fall","winter"] },

  // ── LEATHER / TOBACCO ──
  "leather":      { scent: ["woody","oriental"], season: ["fall","winter"] },
  "suede":        { scent: ["woody"], season: ["fall","winter"] },
  "tobacco":      { scent: ["oriental","woody"], season: ["fall","winter"] },
  "smoke":        { scent: ["oriental"], season: ["fall","winter"] },
  "smoky":        { scent: ["oriental"], season: ["fall","winter"] },

  // ── FRUITY (not strictly a main scent family, maps to fresh/gourmand) ──
  "raspberry":    { scent: ["fruity","gourmand"], season: ["spring","summer"] },
  "strawberry":   { scent: ["fruity","gourmand"], season: ["spring","summer"] },
  "blackberry":   { scent: ["fruity","gourmand"], season: ["spring","summer"] },
  "peach":        { scent: ["fruity","gourmand"], season: ["summer","spring"] },
  "plum":         { scent: ["fruity","gourmand"], season: ["fall"] },
  "cherry":       { scent: ["fruity","gourmand"], season: ["fall","spring"] },
  "apricot":      { scent: ["fruity","gourmand"], season: ["summer","spring"] },
  "mango":        { scent: ["fruity","fresh"], season: ["summer"] },
  "pineapple":    { scent: ["fruity","fresh"], season: ["summer"] },
  "guava":        { scent: ["fruity","fresh"], season: ["summer"] },
  "passionfruit": { scent: ["fruity","fresh"], season: ["summer"] },
  "berries":      { scent: ["fruity","gourmand"], season: ["spring","summer"] },
  "fruity":       { scent: ["fruity","gourmand"], season: ["spring","summer"] },
  "litchi":       { scent: ["fruity","fresh"], season: ["summer","spring"] },
  "currant":      { scent: ["fruity","fresh"], season: ["spring","summer"] },
};

// ─────────────────────────────────────────────
// Accord descriptor patterns (from description headers)
// e.g. "a fresh aromatic-woody fragrance"
// ─────────────────────────────────────────────
const ACCORD_PATTERNS = {
  "woody":     ["woody"],
  "oriental":  ["oriental"],
  "spicy":     ["spicy", "spice"],
  "floral":    ["floral"],
  "citrus":    ["citrus"],
  "fresh":     ["fresh", "aquatic", "aromatic", "marine"],
  "gourmand":  ["gourmand", "sweet"],
  "musky":     ["musky", "musk"],
  "fruity":    ["fruity"],
};

// ─────────────────────────────────────────────
// Occasion derivation from keywords in description
// ─────────────────────────────────────────────
const OCCASION_KEYWORDS = {
  "daily":   ["everyday", "casual", "versatile", "daily", "light", "clean", "easy", "effortless"],
  "special": ["luxury", "luxurious", "elegant", "elegance", "signature", "exclusive", "refined", "sophisticated", "distinguished", "prestigious"],
  "night-out": ["night", "dark", "seductive", "seduction", "intense", "addictive", "sensual", "evening", "evenings", "dates", "provocative"],
  "office":  ["professional", "office", "subtle", "understated", "polished"],
};

// ─────────────────────────────────────────────
// Dislike category → note groups (for the notes[] array)
// ─────────────────────────────────────────────
const DISLIKE_NOTE_GROUPS = {
  "oud":     ["oud", "agarwood", "cypriol"],
  "spices":  ["cinnamon", "cardamom", "pepper", "pink pepper", "black pepper", "clove", "nutmeg", "saffron", "cumin", "caraway", "ginger", "spicy", "spice", "spices"],
  "vanilla": ["vanilla", "tonka", "praline", "toffee", "caramel"],
  "musk":    ["musk", "white musk", "ambrette"],
  "floral":  ["rose", "jasmine", "iris", "orris", "tuberose", "lily", "violet", "geranium", "orange blossom", "neroli", "magnolia", "peony", "lavender", "floral", "flower", "florals"],
  "tobacco": ["tobacco", "smoke", "smoky"],
  "leather": ["leather", "suede"],
  "citrus":  ["lemon", "bergamot", "grapefruit", "orange", "lime", "mandarin", "citron", "citrus", "yuzu", "tangerine", "petitgrain"],
};

// ─────────────────────────────────────────────
// Note extraction from description
// ─────────────────────────────────────────────
function extractNotes(description) {
  if (!description) return [];
  const desc = description.toLowerCase();
  const found = [];

  // Sort note keys by length descending so multi-word matches first
  const noteKeys = Object.keys(NOTE_DICTIONARY).sort((a, b) => b.length - a.length);

  for (const note of noteKeys) {
    // Use word boundary matching
    const regex = new RegExp(`\\b${note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(desc)) {
      // Avoid duplicates from sub-matches
      if (!found.includes(note)) {
        found.push(note);
      }
    }
  }

  return found;
}

// ─────────────────────────────────────────────
// Extract accord descriptors from description header
// e.g. "a fresh aromatic-woody fragrance"
// ─────────────────────────────────────────────
function extractAccords(description) {
  if (!description) return [];
  const desc = description.toLowerCase();
  // Typically in the first sentence
  const firstSentence = desc.split('.')[0] || desc;
  const accords = [];

  for (const [family, keywords] of Object.entries(ACCORD_PATTERNS)) {
    for (const kw of keywords) {
      if (firstSentence.includes(kw)) {
        if (!accords.includes(family)) {
          accords.push(family);
        }
      }
    }
  }

  return accords;
}

// ─────────────────────────────────────────────
// Derive occasion from description keywords
// ─────────────────────────────────────────────
function deriveOccasion(description) {
  if (!description) return ["daily"];
  const desc = description.toLowerCase();
  const scores = { "daily": 0, "special": 0, "night-out": 0, "office": 0 };

  for (const [occasion, keywords] of Object.entries(OCCASION_KEYWORDS)) {
    for (const kw of keywords) {
      if (desc.includes(kw)) {
        scores[occasion] += 1;
      }
    }
  }

  // Sort by score descending, take top ones with score > 0
  const sorted = Object.entries(scores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([occ]) => occ);

  return sorted.length > 0 ? sorted.slice(0, 2) : ["daily"];
}

// ─────────────────────────────────────────────
// Compute tags for a single perfume
// ─────────────────────────────────────────────
function computeTags(perfume) {
  const description = perfume['Short description'] || '';
  const notes = extractNotes(description);
  const accords = extractAccords(description);

  // Scent family scoring
  const scentScores = {};
  const seasonScores = {};

  // Weight from notes
  for (const note of notes) {
    const info = NOTE_DICTIONARY[note];
    if (!info) continue;

    for (const s of info.scent) {
      scentScores[s] = (scentScores[s] || 0) + 1;
    }
    for (const s of info.season) {
      seasonScores[s] = (seasonScores[s] || 0) + 1;
    }
  }

  // Boost from accord descriptors (these are explicit classifications by the brand)
  for (const accord of accords) {
    scentScores[accord] = (scentScores[accord] || 0) + 3; // Accords get heavy weight
  }

  // Sort scent families by score
  const scentSorted = Object.entries(scentScores)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  // Map "fruity" to the closest main family if it's the only one
  // fruity is not a quiz option, so map it
  const mainFamilies = ["fresh", "woody", "oriental", "floral", "citrus", "gourmand", "musky", "spicy"];
  let scentTags = scentSorted.filter(s => mainFamilies.includes(s));

  // If fruity is dominant and no main family, map to gourmand
  if (scentTags.length === 0 && scentSorted.includes("fruity")) {
    scentTags = ["gourmand"];
  }

  // Ensure at least one scent tag
  if (scentTags.length === 0) {
    scentTags = ["fresh"]; // default
  }

  // Sort season by score
  const seasonSorted = Object.entries(seasonScores)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
  const seasonTags = seasonSorted.length > 0 ? seasonSorted.slice(0, 2) : ["spring", "summer"];

  // Derive occasion
  const occasionTags = deriveOccasion(description);

  return {
    tags: {
      scent: scentTags.slice(0, 3),
      occasion: occasionTags,
      season: seasonTags,
    },
    notes: notes,
  };
}

// ─────────────────────────────────────────────
// Map gender values
// ─────────────────────────────────────────────
function mapGender(raw) {
  if (!raw) return "unisex";
  const g = raw.toLowerCase().trim();
  if (g.includes("him") || g === "male" || g === "men") return "male";
  if (g.includes("her") || g === "female" || g === "women") return "female";
  return "unisex";
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function main() {
  const xlsxPath = path.join(__dirname, 'Products.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error('ERROR: Products.xlsx not found in project directory.');
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);

  console.log(`\nProcessing ${data.length} perfumes...\n`);

  const perfumes = data.map((row, i) => {
    const { tags, notes } = computeTags(row);
    const perfume = {
      id: row.ID || i + 1,
      name: row.Name || 'Unknown',
      description: row['Short description'] || '',
      image: row.Images || '',
      url: row.URL || '',
      in_stock: (row['In stock?'] || '').toLowerCase() === 'yes',
      gender: mapGender(row.Gender),
      tags: tags,
      notes: notes,
    };
    return perfume;
  });

  // Generate perfumes.js
  const jsContent = `// Auto-generated by build-perfumes.js — do not edit manually
// Generated: ${new Date().toISOString()}
// Total perfumes: ${perfumes.length}

const PERFUMES = ${JSON.stringify(perfumes, null, 2)};
`;

  const outPath = path.join(__dirname, 'perfumes.js');
  fs.writeFileSync(outPath, jsContent, 'utf-8');
  console.log(`✅ Generated perfumes.js with ${perfumes.length} perfumes.\n`);

  // Print review report
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TAG REVIEW REPORT — Spot-check these for accuracy');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const p of perfumes) {
    const stock = p.in_stock ? '✅' : '❌';
    console.log(`${stock} [${p.gender.toUpperCase()}] ${p.name}`);
    console.log(`   Scent:    ${p.tags.scent.join(', ')}`);
    console.log(`   Occasion: ${p.tags.occasion.join(', ')}`);
    console.log(`   Season:   ${p.tags.season.join(', ')}`);
    console.log(`   Notes:    ${p.notes.join(', ')}`);
    console.log('');
  }

  // Stats
  const scentCounts = {};
  const genderCounts = {};
  for (const p of perfumes) {
    const primary = p.tags.scent[0];
    scentCounts[primary] = (scentCounts[primary] || 0) + 1;
    genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DISTRIBUTION STATS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Primary scent family distribution:');
  Object.entries(scentCounts).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => {
    console.log(`   ${s}: ${c}`);
  });
  console.log('\nGender distribution:');
  Object.entries(genderCounts).forEach(([g,c]) => {
    console.log(`   ${g}: ${c}`);
  });
  console.log(`\nIn stock: ${perfumes.filter(p => p.in_stock).length}`);
  console.log(`Out of stock: ${perfumes.filter(p => !p.in_stock).length}`);
}

main();
