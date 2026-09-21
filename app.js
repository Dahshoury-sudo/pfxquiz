/**
 * app.js — Perfamix Quiz Logic
 * Handles step navigation, scoring algorithm, and result rendering.
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
  // State
  // ─────────────────────────────────────────────
  const TOTAL_STEPS = 5;
  let currentStep = 1;
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
  const quizWrapper = document.getElementById('quizWrapper');
  const resultsWrapper = document.getElementById('resultsWrapper');
  const noResultsWrapper = document.getElementById('noResultsWrapper');
  const progressBar = document.getElementById('progressBar');
  const btnBack = document.getElementById('btnBack');
  const btnNext5 = document.getElementById('btnNext5');
  const btnRestart = document.getElementById('btnRestart');
  const btnRestartNoResults = document.getElementById('btnRestartNoResults');
  const resultsGrid = document.getElementById('resultsGrid');

  // ─────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────
  function updateProgress() {
    const pct = (currentStep / TOTAL_STEPS) * 100;
    progressBar.style.setProperty('--progress', pct + '%');

    document.querySelectorAll('.progress-dot').forEach(dot => {
      const step = parseInt(dot.dataset.step);
      dot.classList.remove('active', 'completed');
      if (step === currentStep) dot.classList.add('active');
      else if (step < currentStep) dot.classList.add('completed');
    });
  }

  // ─────────────────────────────────────────────
  // Step Navigation
  // ─────────────────────────────────────────────
  function showStep(step) {
    currentStep = step;

    document.querySelectorAll('.quiz-step').forEach(el => {
      el.classList.remove('active');
    });

    const stepEl = document.querySelector(`.quiz-step[data-step="${step}"]`);
    if (stepEl) {
      stepEl.classList.add('active');
      // Re-trigger animation
      stepEl.style.animation = 'none';
      stepEl.offsetHeight; // force reflow
      stepEl.style.animation = '';
    }

    // Back button visibility
    btnBack.style.display = step > 1 ? 'block' : 'none';

    updateProgress();
  }

  function goToNextStep() {
    if (currentStep < TOTAL_STEPS) {
      showStep(currentStep + 1);
    } else {
      showResults();
    }
  }

  function goToPrevStep() {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  // ─────────────────────────────────────────────
  // Option Selection — Single Select (Steps 1,2,4,5)
  // ─────────────────────────────────────────────
  function setupSingleSelect(stepNum, answerKey) {
    const container = document.getElementById('options' + stepNum);
    if (!container) return;

    container.addEventListener('click', (e) => {
      const card = e.target.closest('.option-card');
      if (!card) return;

      // Deselect all in this step
      container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));

      // Select this one
      card.classList.add('selected');
      answers[answerKey] = card.dataset.value;

      // Auto-advance after brief delay
      setTimeout(() => {
        goToNextStep();
      }, 350);
    });
  }

  // ─────────────────────────────────────────────
  // Option Selection — Multi Select (Step 5: dislikes)
  // ─────────────────────────────────────────────
  function setupMultiSelect() {
    const container = document.getElementById('options5');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const card = e.target.closest('.option-card');
      if (!card) return;

      const value = card.dataset.value;

      if (value === 'nothing') {
        // "مفيش بحب كل حاجة" — deselect everything, select only this
        container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        answers.dislikes = ['nothing'];
      } else {
        // Deselect "nothing" if selected
        const nothingCard = container.querySelector('[data-value="nothing"]');
        if (nothingCard) nothingCard.classList.remove('selected');
        answers.dislikes = answers.dislikes.filter(v => v !== 'nothing');

        // Toggle this card
        if (card.classList.contains('selected')) {
          card.classList.remove('selected');
          answers.dislikes = answers.dislikes.filter(v => v !== value);
        } else {
          card.classList.add('selected');
          answers.dislikes.push(value);
        }
      }

      // Enable/disable next button
      btnNext5.disabled = answers.dislikes.length === 0;
    });

    // Next button for step 5
    btnNext5.addEventListener('click', () => {
      goToNextStep();
    });
  }

  // ─────────────────────────────────────────────
  // Matching Algorithm
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
              score -= 10;
              scoreDetails.push(`-10 (مكون غير مفضل: ${note})`);
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

    // Sort by score descending, then shuffle ties
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5; // randomize ties
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

    return filtered.slice(0, 3);
  }

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
  // Render Results
  // ─────────────────────────────────────────────
  function showResults() {
    const results = scorePerfumes();

    quizWrapper.style.display = 'none';

    if (results.length === 0) {
      noResultsWrapper.style.display = 'block';
      resultsWrapper.style.display = 'none';
      return;
    }

    resultsWrapper.style.display = 'block';
    noResultsWrapper.style.display = 'none';

    // Calculate match percentage (based on max possible score: 5+4+3 = 12)
    const maxScore = 12;

    resultsGrid.innerHTML = results.map((result, index) => {
      const p = result.perfume;
      const matchPct = Math.min(100, Math.round((result.score / maxScore) * 100));

      // Tags to display
      const tagsList = [
        ...(p.tags.scent || []).slice(0, 2).map(t => TAG_LABELS[t] || t),
        ...(p.tags.season || []).slice(0, 1).map(t => TAG_LABELS[t] || t),
      ];

      return `
        <div class="perfume-card">
          <div class="perfume-card-image-wrapper">
            <div class="perfume-card-rank">${index + 1}</div>
            <img 
              class="perfume-card-image" 
              src="${p.image}" 
              alt="${p.name}"
              loading="lazy"
              onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%23f0f0f0%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22>لا توجد صورة</text></svg>'"
            >
          </div>
          <div class="perfume-card-body">
            <h3 class="perfume-card-name">${p.name}</h3>
            <p class="perfume-card-description">${p.description}</p>
            <div class="perfume-card-tags">
              ${tagsList.map(t => `<span class="perfume-tag">${t}</span>`).join('')}
            </div>
            <a href="${p.url}" target="_blank" rel="noopener" class="perfume-card-cta">
              اطلب الآن
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // ─────────────────────────────────────────────
  // Restart
  // ─────────────────────────────────────────────
  function restart() {
    // Reset answers
    answers.gender = null;
    answers.scent = null;
    answers.dislikes = [];
    answers.occasion = null;
    answers.season = null;

    // Clear selections
    document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    btnNext5.disabled = true;

    // Show quiz, hide results
    quizWrapper.style.display = 'flex';
    resultsWrapper.style.display = 'none';
    noResultsWrapper.style.display = 'none';

    showStep(1);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────
  function init() {
    // Setup single-select steps
    setupSingleSelect(1, 'gender');
    setupSingleSelect(2, 'scent');
    setupSingleSelect(3, 'occasion');
    setupSingleSelect(4, 'season');

    // Setup multi-select step
    setupMultiSelect();

    // Back button
    btnBack.addEventListener('click', goToPrevStep);

    // Restart buttons
    btnRestart.addEventListener('click', restart);
    btnRestartNoResults.addEventListener('click', restart);

    // Initial state
    showStep(1);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
