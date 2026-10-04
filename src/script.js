function shuffle(arr) { return fisherYatesShuffle(arr); }

function fisherYatesShuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function buildUnique(count, genOne, maxTries) {
    const out = [], seen = new Set();
    let tries = 0; maxTries = maxTries || count * 60;
    while (out.length < count && tries < maxTries) {
        tries++;
        const q = genOne();
        if (!q) continue;
        const k = q._key !== undefined ? q._key : q.prompt;
        if (seen.has(k)) continue;
        seen.add(k);
        delete q._key;
        out.push(q);
    }
    return out;
}

function fitFont(text, base, min) {
    const len = String(text).replace(/<[^>]*>/g, "").length;
    let size = base - Math.max(0, len - 4) * 0.03;
    return Math.max(min, size).toFixed(2) + "rem";
}

function launchConfetti() {
    const colors = ['#FF6F59', '#1FAE9C', '#8B5CF6', '#F4A100', '#3B82C4', '#2FA84F'];
    const fragment = document.createDocumentFragment();
    const pieces = [];

    for (let i = 0; i < 16; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = (1.0 + Math.random() * 1.1) + 's';
        el.style.animationDelay = (Math.random() * 0.2) + 's';
        fragment.appendChild(el);
        pieces.push(el);
    }

    document.body.appendChild(fragment);
    pieces.forEach((el) => setTimeout(() => el.remove(), 2600));
}

const SHAPE_LOOKUP = Object.fromEntries(SHAPES.map(shape => [shape.name, shape]));
const questionCache = new Map();

function getCachedQuestions(key, difficulty = null, language = null) {
    const cacheKey = JSON.stringify({ key, difficulty, language });

    if (!questionCache.has(cacheKey)) {
        const subject = SUBJECTS[key];
        if (!subject || typeof subject.build !== 'function') {
            questionCache.set(cacheKey, []);
            return [];
        }

        const questions = language
            ? subject.build(language)
            : difficulty !== null
                ? subject.build(difficulty)
                : subject.build();

        questionCache.set(cacheKey, questions);
    }

    return questionCache.get(cacheKey);
}

function renderScreen(view) {
    const app = document.getElementById('app');
    if (!app) return;

    if (view === 'question' && state) {
        app.innerHTML = questionHTML();
        attachQuestion();
        return;
    }

    if (typeof render === 'function') {
        render();
        return;
    }

    app.innerHTML = '<div class="loading-wrap"><h2>Loading…</h2></div>';
}

function getProfileQuestionKey(question) {
    if (!question) return '';
    return question._key !== undefined ? String(question._key) : String(question.prompt);
}

function getProfileAnsweredQuestionKeys() {
    const p = activeProfile();
    if (!p) return new Set();
    p.answeredQuestions = Array.isArray(p.answeredQuestions) ? p.answeredQuestions : [];
    return new Set(p.answeredQuestions);
}

function filterAnsweredQuestions(questions) {
    const answered = getProfileAnsweredQuestionKeys();
    if (!answered.size || !Array.isArray(questions)) return questions || [];
    return questions.filter(q => !answered.has(getProfileQuestionKey(q)));
}

function markQuestionAnswered(question) {
    const p = activeProfile();
    if (!p || !question) return;
    p.answeredQuestions = Array.isArray(p.answeredQuestions) ? p.answeredQuestions : [];
    const key = getProfileQuestionKey(question);
    if (!key) return;

    const nextSet = new Set(p.answeredQuestions);
    nextSet.add(key);
    p.answeredQuestions = Array.from(nextSet);
    persist();
}

function questionHTML() {
    const s = SUBJECTS[state.key];
    const q = state.questions[state.index];
    const pct = Math.round((state.index / state.questions.length) * 100);
    let stage = q.stageHTML ? `<div class="stage">${q.stageHTML}</div>` : "";
    let optionsBlock;
    if (q.isWriting) {
        optionsBlock = `<div class="writing-area">
        <textarea class="writing-input" id="writingInput" placeholder="Start writing here..."></textarea>
        <button class="next-btn" id="nextBtn" style="background:${s.color}">Next</button>
    </div>`;
    } else if (q.isShapeQ) {
        optionsBlock = `<div class="options">` + q.optionsHTML.map(o => {
            const shapeDef = SHAPE_LOOKUP[o.name];
            return `<button class="opt" data-val="${o.name}">${shapeDef ? shapeDef.svg(o.color) : ''}</button>`;
        }).join("") + `</div>`;
    } else {
        optionsBlock = `<div class="options">` + q.options.map(o =>
            `<button class="opt" style="font-size:${fitFont(o, 1.3, 0.78)}" data-val="${o}">${o}</button>`).join("") + `</div>`;
    }
    const diffTag = state.difficulty ? `<span style="text-transform:capitalize">${state.difficulty}</span> · ` : "";
    const streakTag = (state.streak || 0) >= 3 ? ` <span title="Streak">🔥${state.streak}</span>` : "";
    return `
    <div class="topbar" style="--c:${s.color}">
      <button class="back" id="backBtn">← Subjects</button>
      <div class="progress"><div style="width:${pct}%;background:${s.color}"></div></div>
      <div class="counter">${diffTag}${state.index + 1}/${state.questions.length}${streakTag}</div>
    </div>
    <div class="q-card">
      <p class="prompt" style="font-size:${fitFont(q.prompt, 1.4, 1.0)}">${q.prompt}</p>
      ${stage}
      ${optionsBlock}
      <div class="feedback" id="fb"></div>
      <button class="next-btn" id="nextBtn" style="background:${s.color}" disabled>Next</button>
    </div>
  `;
}

function attachQuestion() {
    document.getElementById('backBtn')?.addEventListener('click', () => { state = null; render(); });
    const q = state.questions[state.index];
    const fb = document.getElementById('fb');
    const nextBtn = document.getElementById('nextBtn');
    const optionsContainer = document.querySelector('.options');
    let locked = false;

    if (q.isWriting) {
        const writingInput = document.getElementById('writingInput');
        writingInput?.addEventListener('input', () => {
            nextBtn.disabled = !writingInput.value.trim();
        });

        nextBtn?.addEventListener('click', () => {
            state.index++;
            saveSession();
            renderScreen('question');
        });
        return;
    }

    if (optionsContainer) {
        optionsContainer.addEventListener('click', (event) => {
            const btn = event.target.closest('.opt');
            if (!btn || locked) return;
            locked = true;
            const { val } = btn.dataset;
            const isCorrect = String(val) === String(q.answer);
            const optionButtons = Array.from(document.querySelectorAll('.opt'));

            optionButtons.forEach(b => {
                b.disabled = true;
                if (String(b.dataset.val) === String(q.answer)) b.classList.add('correct');
                else if (b === btn) b.classList.add('wrong');
            });

            if (isCorrect) {
                state.correct++; state.streak = (state.streak || 0) + 1;
                fb.textContent = pick(GOOD_PHRASES); fb.className = 'feedback good';
                playCorrect();
            } else {
                state.streak = 0;
                fb.textContent = pick(BAD_PHRASES); fb.className = 'feedback bad';
                playWrong();
            }

            markQuestionAnswered(q);
            saveSession();
            nextBtn.disabled = false;
        });
    }

    nextBtn?.addEventListener('click', () => {
        state.index++;
        if (state.index >= state.questions.length) {
            const s = SUBJECTS[state.key];
            recordSession(state.key, s.name, state.difficulty, state.correct, state.questions.length);
            clearSession();
            playFinish();
            render();
            return;
        }

        saveSession();
        renderScreen('question');
    });
}

if (typeof window !== 'undefined') {
    window.getCachedQuestions = getCachedQuestions;
    window.renderScreen = renderScreen;
}

// Per-profile speaking of answered questions in generated worksheets
function getAnsweredQuestionSet() {
    const p = activeProfile();
    if (!p) return new Set();
    p.answeredQuestions = Array.isArray(p.answeredQuestions) ? p.answeredQuestions : [];
    return new Set(p.answeredQuestions);
}

function withAnsweredFilters(questions) {
    const answered = getAnsweredQuestionSet();
    if (!answered.size) return questions;
    return questions.filter(q => {
        const key = q._key !== undefined ? String(q._key) : String(q.prompt);
        return !answered.has(key);
    });
}

function loadQuestionSet(subjectKey, difficulty = null, language = null) {
    const subject = SUBJECTS[subjectKey];
    if (!subject || typeof subject.build !== 'function') return [];

    let questions = language
        ? subject.build(language)
        : difficulty !== null
            ? subject.build(difficulty)
            : subject.build();

    questions = withAnsweredFilters(questions);
    if (questions.length === 0) return [];
    return questions;
}

function rebuildWorksheetState(key, difficulty = null, language = null) {
    const subject = SUBJECTS[key];
    if (!subject || typeof subject.build !== 'function') return;

    let questions = language
        ? subject.build(language)
        : difficulty !== null
            ? subject.build(difficulty)
            : subject.build();

    questions = withAnsweredFilters(questions);
    if (questions.length === 0) {
        state = {
            key,
            color: subject.color,
            difficulty,
            questions: [],
            index: 0,
            correct: 0,
            streak: 0
        };
        return;
    }

    state = {
        key,
        color: subject.color,
        difficulty,
        questions,
        index: 0,
        correct: 0,
        streak: 0
    };
}

// The main state creation points now use answered-question filtering.
// Example:
// const s = SUBJECTS[key];
// state = { key, color: s.color, difficulty: null, questions: withAnsweredFilters(s.build()), index: 0, correct: 0, streak: 0 };
