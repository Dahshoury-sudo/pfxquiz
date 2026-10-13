/**
 * app.js — Perfamix Quiz
 * Step navigation, matching algorithm, and result rendering.
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // Dislike category → notes mapping
  // ─────────────────────────────────────────────
  const DISLIKE_NOTE_GROUPS = {
    oud:     ["oud", "agarwood", "cypriol"],
    spices:  ["cinnamon", "cardamom", "pepper", "pink pepper", "black pepper", "clove", "nutmeg", "saffron", "cumin", "caraway", "ginger", "spicy", "spice", "spices"],
    vanilla: ["vanilla", "tonka", "praline", "toffee", "caramel"],
    musk:    ["musk", "white musk", "ambrette"],
    floral:  ["rose", "jasmine", "iris", "orris", "tuberose", "lily", "violet", "geranium", "orange blossom", "neroli", "magnolia", "peony", "lavender", "floral", "flower", "florals"],
    tobacco: ["tobacco", "smoke", "smoky"],
    leather: ["leather", "suede"],
    citrus:  ["lemon", "bergamot", "grapefruit", "orange", "lime", "mandarin", "citron", "citrus", "yuzu", "tangerine", "petitgrain"],
  };

  // ─────────────────────────────────────────────
  // Tag display names (Arabic)
  // ─────────────────────────────────────────────
  const TAG_LABELS = {
    // Scent
    fresh: 'فريش', woody: 'خشبي', oriental: 'شرقي', floral: 'زهري',
    citrus: 'حمضي', gourmand: 'حلو', musky: 'مسكي', spicy: 'توابل',
    // Occasion
    daily: 'يومي', special: 'مناسبات', 'night-out': 'سهرات', office: 'شغل',
    // Season
    spring: 'ربيع', summer: 'صيف', fall: 'خريف', winter: 'شتاء',
  };

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  const TOTAL_STEPS = 5;
  const ADVANCE_DELAY = 320;
  const IS_IFRAME = window !== window.parent;

  let currentStep = 1;
  let advanceTimer = null;
  let hasStarted = false;

  const answers = {
    gender: null,      // step 1
    scent: null,       // step 2
    occasion: null,    // step 3
    season: null,      // step 4
    dislikes: [],      // step 5 (multi-select)
  };

  // ─────────────────────────────────────────────
  // DOM refs
  // ─────────────────────────────────────────────
  const quiz         = document.getElementById('quiz');
  const results      = document.getElementById('results');
  const empty        = document.getElementById('empty');
  const resultsGrid  = document.getElementById('resultsGrid');
  const resultsNote  = document.getElementById('resultsNote');
  const resultsTitle = document.getElementById('resultsTitle');
  const rationaleChoices = document.getElementById('rationaleChoices');
  const rationaleText    = document.getElementById('rationaleText');
  const emptyTitle   = document.getElementById('emptyTitle');
  const btnFinish    = document.getElementById('btnFinish');

  const steps = Array.from(document.querySelectorAll('.quiz-step'));

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  /** 3 → "٠٣" — Arabic-Indic digits, as used across the page. */
  function arNum(n, pad) {
    const s = String(n).padStart(pad || 0, '0');
    return s.replace(/\d/g, d => AR_DIGITS[+d]);
  }

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** The catalogue is generated from Products.xlsx, so names and
   *  descriptions are external content going into innerHTML. */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollToTop() {
    if (window.scrollY === 0) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  /** Ask the parent page to scroll to the iframe — only on major view changes. */
  function scrollParentToQuiz() {
    if (IS_IFRAME) {
      window.parent.postMessage({ type: 'perfamix-scroll-top' }, '*');
    }
  }

  /** The Arabic label the customer actually saw and pressed, read back
   *  off the option itself. TAG_LABELS can't serve here: it has no
   *  gender entries, and where it overlaps step 5 it disagrees with the
   *  buttons (floral → 'زهري' vs the button's 'زهور'). Reading the
   *  markup keeps one source for this copy instead of two that drift. */
  function chosenLabel(key) {
    const group = document.querySelector('[data-answer="' + key + '"]');
    const name = group && group.querySelector('[aria-checked="true"] .option-name');
    return name ? name.textContent.trim() : '';
  }

  function chosenDislikeLabels() {
    const pressed = document.querySelectorAll(
      '[data-select="multi"] [aria-pressed="true"] .option-name'
    );
    return Array.from(pressed, el => el.textContent.trim());
  }

  // ─────────────────────────────────────────────
  // Analytics
  //
  // Vercel Web Analytics is injected as plain script tags in index.html,
  // so window.va is the whole API — the npm `track` helper isn't loaded.
  // Everything funnels through here so the quiz logic never names a
  // provider, and a second one can be added in this spot alone.
  //
  // Custom events need a Pro plan, and plain Pro caps custom data at two
  // properties per event. Nested objects and arrays are rejected outright,
  // so anything like `dislikes` would have to be flattened to a string.
  // ─────────────────────────────────────────────
  function track(name, data) {
    try {
      if (typeof window.va === 'function') {
        window.va('event', data ? { name: name, data: data } : { name: name });
      }
    } catch (err) {
      // Measurement must never break the quiz.
    }
  }

  // ─────────────────────────────────────────────
  // Step navigation
  // ─────────────────────────────────────────────
  function showStep(step, moveFocus) {
    currentStep = step;

    steps.forEach(el => {
      el.classList.toggle('is-active', Number(el.dataset.step) === step);
    });

    const active = steps.find(el => Number(el.dataset.step) === step);
    if (active) {
      const group = active.querySelector('[data-select="single"]');
      if (group) syncRovingTabindex(group);

      // Keyboard and screen-reader users would otherwise be stranded on
      // the option they just activated, which no longer exists on screen.
      if (moveFocus) {
        const title = active.querySelector('.question-title');
        if (title) title.focus();
      }
    }


    scrollToTop();
  }

  function goNext() {
    if (currentStep < TOTAL_STEPS) showStep(currentStep + 1, true);
    else showResults();
  }

  function goBack() {
    if (currentStep > 1) showStep(currentStep - 1, true);
  }

  // ─────────────────────────────────────────────
  // Single select (steps 1–4)
  //
  // Buttons carry role="radio", so they need the roving tabindex the
  // pattern expects. Selection is manual rather than following focus:
  // choosing an option advances the step, which is too large a
  // consequence to trigger on an arrow key.
  // ─────────────────────────────────────────────
  function radiosOf(group) {
    return Array.from(group.querySelectorAll('[role="radio"]'));
  }

  function syncRovingTabindex(group) {
    const radios = radiosOf(group);
    if (!radios.length) return;
    const checked = radios.find(r => r.getAttribute('aria-checked') === 'true');
    radios.forEach(r => { r.tabIndex = -1; });
    (checked || radios[0]).tabIndex = 0;
  }

  function setupSingleSelect(group) {
    const key = group.dataset.answer;

    group.addEventListener('click', e => {
      const option = e.target.closest('[role="radio"]');
      if (!option || !group.contains(option)) return;

      radiosOf(group).forEach(r => r.setAttribute('aria-checked', 'false'));
      option.setAttribute('aria-checked', 'true');
      answers[key] = option.dataset.value;
      syncRovingTabindex(group);

      // There's no intro screen, so the first answer — not the page load —
      // is the first real sign of engagement. The flag stops a re-tap, or a
      // trip back through the steps, from counting as a second start.
      if (!hasStarted) {
        hasStarted = true;
        track('quiz_started');
      }

      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(goNext, ADVANCE_DELAY);
    });

    group.addEventListener('keydown', e => {
      const radios = radiosOf(group);
      const index = radios.indexOf(document.activeElement);
      if (index === -1) return;

      let next;
      switch (e.key) {
        // The page is RTL, so the next sibling sits to the left.
        case 'ArrowLeft':
        case 'ArrowDown':
          next = radios[(index + 1) % radios.length];
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = radios[(index - 1 + radios.length) % radios.length];
          break;
        case 'Home':
          next = radios[0];
          break;
        case 'End':
          next = radios[radios.length - 1];
          break;
        default:
          return;
      }

      e.preventDefault();
      radios.forEach(r => { r.tabIndex = -1; });
      next.tabIndex = 0;
      next.focus();
    });

    syncRovingTabindex(group);
  }

  // ─────────────────────────────────────────────
  // Multi select (step 5 — dislikes)
  // ─────────────────────────────────────────────
  function setupMultiSelect(group) {
    const options = Array.from(group.querySelectorAll('[aria-pressed]'));

    function setPressed(option, pressed) {
      option.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    group.addEventListener('click', e => {
      const option = e.target.closest('[aria-pressed]');
      if (!option || !group.contains(option)) return;

      const value = option.dataset.value;

      if (value === 'nothing') {
        options.forEach(o => setPressed(o, o === option));
        answers.dislikes = ['nothing'];
      } else {
        const optOut = options.find(o => o.dataset.value === 'nothing');
        if (optOut) setPressed(optOut, false);
        answers.dislikes = answers.dislikes.filter(v => v !== 'nothing');

        const nowPressed = option.getAttribute('aria-pressed') !== 'true';
        setPressed(option, nowPressed);
        answers.dislikes = nowPressed
          ? answers.dislikes.concat(value)
          : answers.dislikes.filter(v => v !== value);
      }

      btnFinish.disabled = answers.dislikes.length === 0;
    });
  }

  // ─────────────────────────────────────────────
  // Matching algorithm
  // ─────────────────────────────────────────────
  function scorePerfumes() {
    console.group("=== تفاصيل الفلترة وحساب النقاط ===");
    console.log("إجابات المستخدم:", JSON.parse(JSON.stringify(answers)));

    const candidates = PERFUMES.filter(p => {
      // Hard filter: stock
      if (!p.in_stock) return false;

      // Hard filter: gender
      if (answers.gender === 'unisex') {
        if (p.gender !== 'unisex') return false; // حصرياً للجنسين
      } else {
        if (p.gender !== answers.gender && p.gender !== 'unisex') {
          return false; // يقبل النوع المحدد أو ما يناسب الجنسين
        }
      }

      return true;
    });

    console.log(`تم العثور على ${candidates.length} عطر بعد فلترة المخزون والنوع.`);

    const scored = candidates.map(p => {
      let score = 0;
      let scoreDetails = [];

      // ── Negative scoring: dislikes ──
      if (answers.dislikes.length > 0 && !answers.dislikes.includes('nothing')) {
        for (const dislike of answers.dislikes) {
          const badNotes = DISLIKE_NOTE_GROUPS[dislike] || [];
          for (const note of p.notes) {
            if (badNotes.includes(note.toLowerCase())) {
              score -= 4;
              scoreDetails.push(`-4 (مكون غير مفضل: ${note})`);
            }
          }
        }
      }

      // ── Positive scoring: scent family ──
      if (p.tags.scent && answers.scent) {
        if (p.tags.scent[0] === answers.scent) {
          score += 5;
          scoreDetails.push(`+5 (تطابق العائلة العطرية الأساسي: ${answers.scent})`);
        } else if (p.tags.scent[1] === answers.scent) {
          score += 3;
          scoreDetails.push(`+3 (تطابق العائلة العطرية الثانوي: ${answers.scent})`);
        } else if (p.tags.scent.includes(answers.scent)) {
          score += 1;
          scoreDetails.push(`+1 (تطابق العائلة الفرعية: ${answers.scent})`);
        }
      }

      // ── Positive scoring: occasion ──
      if (p.tags.occasion && answers.occasion) {
        if (p.tags.occasion.includes(answers.occasion)) {
          score += 4;
          scoreDetails.push(`+4 (تطابق المناسبة: ${answers.occasion})`);
        }
      }

      // ── Positive scoring: season ──
      if (p.tags.season && answers.season) {
        if (p.tags.season.includes(answers.season)) {
          score += 3;
          scoreDetails.push(`+3 (تطابق الموسم: ${answers.season})`);
        }
      }

      return { perfume: p, score, scoreDetails };
    });

    // Sort by score descending, then prefer exact gender match, then shuffle ties
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreaker: exact gender match ranks above unisex
      if (answers.gender !== 'unisex') {
        const aExact = a.perfume.gender === answers.gender ? 1 : 0;
        const bExact = b.perfume.gender === answers.gender ? 1 : 0;
        if (bExact !== aExact) return bExact - aExact;
      }
      return Math.random() - 0.5; // randomize remaining ties
    });

    // Filter out heavily penalized perfumes (score < 0)
    const filtered = scored.filter(s => s.score > 0);

    // Log the top results to console
    console.log("قائمة العطور بعد الحساب والترتيب:");
    scored.forEach((s, idx) => {
      let isSelected = idx < 3 && s.score > 0 ? "✅ (مرشح لك)" : "❌ (مستبعد)";
      if (s.score <= 0) isSelected = "⛔ (نقاط صفر أو أقل)";
      console.log(`${idx + 1}. ${s.perfume.name} | النقاط الإجمالية: ${s.score} | ${isSelected}\n   تفاصيل النقاط: ${s.scoreDetails.length > 0 ? s.scoreDetails.join(", ") : "لا يوجد (0 نقاط)"}`);
    });
    console.groupEnd();

    // candidates.length is what the rationale block reports to the
    // customer ("منهم ٦٨ يناسبوا النوع اللي اخترته"). Returning it here
    // rather than recomputing the gender filter elsewhere keeps that
    // number and the actual filter from ever drifting apart.
    return { picks: filtered.slice(0, 3), candidateCount: candidates.length };
  }

  // ─────────────────────────────────────────────
  // Render results
  // ─────────────────────────────────────────────
  const CTA_ARROW = '<svg class="cta-arrow" viewBox="0 0 11 11" aria-hidden="true">' +
    '<path d="M8.5 8.5 L2.5 2.5 M2.5 7.5 L2.5 2.5 L7.5 2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function perfumeCard(result, index) {
    const p = result.perfume;

    const notes = []
      .concat((p.tags.scent || []).slice(0, 2))
      .concat((p.tags.season || []).slice(0, 1))
      .map(t => TAG_LABELS[t] || t)
      .join(' · ');

    return `
      <article class="perfume">
        <figure class="perfume-figure">
          <div class="perfume-fallback"><span>${esc(p.name)}</span></div>
          <img src="${esc(p.image)}" alt="عطر ${esc(p.name)}" loading="lazy" width="300" height="300">
        </figure>
        <div class="perfume-body">
          <span class="perfume-rank">${arNum(index + 1, 2)}</span>
          <h2 class="perfume-name">${esc(p.name)}</h2>
          <p class="perfume-notes">${esc(notes)}</p>
          <p class="perfume-desc">${esc(p.description)}</p>
          <a class="perfume-cta" href="${esc(p.url)}" target="_blank" rel="noopener"
             data-perfume-name="${esc(p.name)}" data-rank="${index + 1}">
            <span>اطلب الآن</span>${CTA_ARROW}
          </a>
        </div>
      </article>
    `;
  }

  /** Reveal the typographic tile behind any packshot that fails. */
  function watchImages(root) {
    root.querySelectorAll('img').forEach(img => {
      if (img.complete && img.naturalWidth === 0) img.hidden = true;
      else img.addEventListener('error', () => { img.hidden = true; }, { once: true });
    });
  }

  // ─────────────────────────────────────────────
  // Rationale — why these three
  //
  // The matching logic already explains itself, but only to the console.
  // This says the same thing to the customer, and every claim it makes
  // is checkable against scorePerfumes(): scent family first (+5/+3/+1),
  // then occasion (+4), then season (+3), with disliked notes at -4
  // each and anything at or below zero dropped.
  // ─────────────────────────────────────────────

  /* The four single-select answers, in the order the quiz asked them. */
  const RATIONALE_ROWS = [
    { key: 'gender',   label: 'النوع' },
    { key: 'scent',    label: 'الريحة' },
    { key: 'occasion', label: 'المناسبة' },
    { key: 'season',   label: 'الموسم' },
  ];

  /** Arabic marks the dual, so a bare numeral reads wrong at one and
   *  two — "أقرب ١ لاختياراتك" is not a sentence anyone would say. */
  function picksPhrase(n) {
    if (n === 1) return 'ده أقرب عطر لاختياراتك.';
    if (n === 2) return 'دول أقرب عطرين لاختياراتك.';
    return `دول أقرب ${arNum(n)} عطور لاختياراتك.`;
  }

  function buildRationale(inStock, candidateCount) {
    const rows = RATIONALE_ROWS
      .map(row => ({ label: row.label, value: chosenLabel(row.key) }))
      .filter(row => row.value);

    // "مفيش، بحب كل حاجة" is a stated preference, not a list of
    // dislikes — scorePerfumes skips the penalty entirely for it, so
    // neither the row nor the sentence below may claim it ran.
    const avoiding = answers.dislikes.includes('nothing') ? [] : chosenDislikeLabels();
    if (avoiding.length) rows.push({ label: 'بتتجنب', value: avoiding.join('، ') });

    rationaleChoices.innerHTML = rows
      .map(row => `<dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd>`)
      .join('');

    rationaleText.textContent =
      `بدأنا من ${arNum(inStock)} عطر متاح دلوقتي، منهم ${arNum(candidateCount)} ` +
      'يناسبوا النوع اللي اخترته. رتبناهم بعد كده حسب أهمية اختياراتك: ' +
      'العائلة العطرية الأول، بعدها المناسبة، بعدها الموسم' +
      (avoiding.length
        ? ' — وأي عطر فيه ريحه من الحاجات الي مش بتحبها اتأخر في الترتيب او اتشال خالص.'
        : '.');
  }

  function setView(view) {
    quiz.hidden = view !== 'quiz';
    results.hidden = view !== 'results';
    empty.hidden = view !== 'empty';
  }

  function showResults() {
    const { picks, candidateCount } = scorePerfumes();

    // Fires on the empty state too, as `results: 0`. Answering all five
    // questions is a finish whether or not the catalogue had anything to
    // offer, and the count keeps the two apart without a second event name.
    track('quiz_completed', { results: picks.length });

    if (!picks.length) {
      setView('empty');
      emptyTitle.focus();
      scrollToTop();
      scrollParentToQuiz();
      return;
    }

    const inStock = PERFUMES.filter(p => p.in_stock).length;

    resultsGrid.innerHTML = picks.map(perfumeCard).join('');
    watchImages(resultsGrid);

    // The funnel figures live in the rationale block below, so this
    // line only frames the three cards.
    resultsNote.textContent = picksPhrase(picks.length);
    buildRationale(inStock, candidateCount);

    setView('results');
    resultsTitle.focus();
    scrollToTop();
    scrollParentToQuiz();
  }

  // ─────────────────────────────────────────────
  // Restart
  // ─────────────────────────────────────────────
  function restart() {
    // Read the view before setView swaps it out — it's what separates
    // "didn't like the three picks" from "got no matches at all".
    track('quiz_restarted', { from: results.hidden ? 'empty' : 'results' });

    // A restart is a fresh attempt: showResults will fire quiz_completed
    // again, so quiz_started has to be allowed to fire again too, or the
    // two halves of the funnel stop being comparable.
    hasStarted = false;

    answers.gender = null;
    answers.scent = null;
    answers.occasion = null;
    answers.season = null;
    answers.dislikes = [];

    document.querySelectorAll('[role="radio"]').forEach(o => o.setAttribute('aria-checked', 'false'));
    document.querySelectorAll('[aria-pressed]').forEach(o => o.setAttribute('aria-pressed', 'false'));
    btnFinish.disabled = true;
    resultsGrid.innerHTML = '';
    rationaleChoices.innerHTML = '';
    rationaleText.textContent = '';

    setView('quiz');
    showStep(1, true);
  }

  // ─────────────────────────────────────────────
  // Iframe bridge — seamless embedding
  // ─────────────────────────────────────────────
  function setupIframeBridge() {
    if (!IS_IFRAME) return;

    // Blend with the parent page — no visible iframe boundary
    document.documentElement.style.overflow = 'hidden';
    document.body.style.background = 'transparent';

    // Send the content height to the parent whenever it changes
    let resizeTimer = null;
    let lastHeight = 0;
    function postHeight() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        const h = document.body.scrollHeight;
        if (h !== lastHeight) {
          lastHeight = h;
          window.parent.postMessage({ type: 'perfamix-resize', height: h }, '*');
        }
      }, 60);
    }

    // Observe the body for size changes
    const ro = new ResizeObserver(postHeight);
    ro.observe(document.body);

    // Also post on load (fonts, images)
    postHeight();
    window.addEventListener('load', postHeight);
  }

  // ─────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-select="single"]').forEach(setupSingleSelect);
    document.querySelectorAll('[data-select="multi"]').forEach(setupMultiSelect);

    document.querySelectorAll('.js-back').forEach(btn => btn.addEventListener('click', goBack));
    document.querySelectorAll('.js-restart').forEach(btn => btn.addEventListener('click', restart));
    btnFinish.addEventListener('click', showResults);

    // The cards are rebuilt with innerHTML on every run, so the CTA click is
    // caught by delegation rather than by re-binding three listeners each
    // time. The link opens a new tab, so the page is never unloaded and the
    // event has time to send.
    resultsGrid.addEventListener('click', e => {
      const cta = e.target.closest('.perfume-cta');
      if (!cta || !resultsGrid.contains(cta)) return;

      track('perfume_clicked', {
        perfume: cta.dataset.perfumeName,
        rank: Number(cta.dataset.rank),
      });
    });

    setupIframeBridge();
    showStep(1, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
