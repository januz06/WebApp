import { signOut, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase-config.js";
import { getDatabase, ref, set, get } from "firebase/database";

const db = getDatabase();

// ✅ Define the observer where the UI logic lives
onAuthStateChanged(auth, (user) => {
    if (user) {
        initStorage(); 
    } else {
        activeProfileId = null;
        profiles = [];
        storageReady = false;
        render(); 
    }
});

/* ====== PERSISTENCE LAYER (Cleaner Structure) ====== */
function persistProfile(profile = null) {
    const p = profile || activeProfile();
    if (!p) return;

    const profiles = JSON.parse(localStorage.getItem('profiles') || '[]');
    const idx = profiles.findIndex(pr => pr.id === p.id);
    if (idx >= 0) {
        profiles[idx] = p;
    } else {
        profiles.push(p);
    }

    localStorage.setItem('profiles', JSON.stringify(profiles));
    localStorage.setItem('activeProfile', p.id);
}

function persist() {
    persistProfile();
}

function getQuestionKey(question) {
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
    return questions.filter(q => !answered.has(getQuestionKey(q)));
}

function markQuestionAnswered(question) {
    const p = activeProfile();
    if (!p || !question) return;

    p.answeredQuestions = Array.isArray(p.answeredQuestions) ? p.answeredQuestions : [];
    const key = getQuestionKey(question);
    if (!key) return;

    const nextSet = new Set(p.answeredQuestions);
    nextSet.add(key);
    p.answeredQuestions = Array.from(nextSet);
    persistProfile(p);
}

function buildQuestionSetForProfile(subjectKey, difficulty = null, language = null) {
    const subject = SUBJECTS[subjectKey];
    if (!subject || typeof subject.build !== 'function') return [];

    let questions = language
        ? subject.build(language)
        : difficulty !== null
            ? subject.build(difficulty)
            : subject.build();

    questions = filterAnsweredQuestions(questions);
    return questions;
}

function initializeWorksheetState(key, difficulty = null, language = null) {
    const subject = SUBJECTS[key];
    if (!subject || typeof subject.build !== 'function') return false;

    const questions = buildQuestionSetForProfile(key, difficulty, language);
    if (questions.length === 0) return false;

    state = {
        key,
        color: subject.color,
        difficulty,
        questions,
        index: 0,
        correct: 0,
        streak: 0
    };

    saveSession();
    return true;
}

function getAnsweredCountForSubject(subjectKey) {
    const p = activeProfile();
    if (!p) return 0;

    const answered = new Set(p.answeredQuestions || []);
    const subject = SUBJECTS[subjectKey];
    if (!subject || typeof subject.build !== 'function') return 0;

    const allQuestions = subject.build();
    return allQuestions.filter(q => answered.has(getQuestionKey(q))).length;
}

function getTotalQuestionsForSubject(subjectKey) {
    const subject = SUBJECTS[subjectKey];
    if (!subject || typeof subject.build !== 'function') return 0;
    return subject.build().length;
}

function getSubjectProgressText(subjectKey) {
    const answered = getAnsweredCountForSubject(subjectKey);
    if (answered === 0) return '';
    const total = getTotalQuestionsForSubject(subjectKey);
    return ` · ${answered}/${total} answered`;
}

function shouldShowNewQuestionsNotification(subjectKey) {
    const p = activeProfile();
    if (!p || !p.lastNotifiedSubjects) return false;
    return !p.lastNotifiedSubjects.includes(subjectKey);
}

function markSubjectNotified(subjectKey) {
    const p = activeProfile();
    if (!p) return;
    p.lastNotifiedSubjects = Array.isArray(p.lastNotifiedSubjects) ? p.lastNotifiedSubjects : [];
    if (!p.lastNotifiedSubjects.includes(subjectKey)) {
        p.lastNotifiedSubjects.push(subjectKey);
    }
    persistProfile(p);
}

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
    const len = String(text).replace(/<[^>]*>/g, '').length;
    let size = base - Math.max(0, len - 4) * 0.03;
    return Math.max(min, size).toFixed(2) + 'rem';
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

function questionHTML() {
    const s = SUBJECTS[state.key];
    const q = state.questions[state.index];
    const pct = Math.round((state.index / state.questions.length) * 100);
    const stage = q.stageHTML ? `<div class="stage">${q.stageHTML}</div>` : '';

    let optionsBlock = '';
    if (q.isWriting) {
        optionsBlock = `
            <div class="writing-area">
                <textarea class="writing-input" id="writingInput" placeholder="Start writing here..." rows="6"></textarea>
            </div>
        `;
    } else if (q.isShapeQ) {
        optionsBlock = `<div class="options">${q.optionsHTML.map(o => {
            const shapeDef = SHAPE_LOOKUP[o.name];
            return `<button class="opt" data-val="${o.name}">${shapeDef ? shapeDef.svg(o.color) : ''}</button>`;
        }).join('')}</div>`;
    } else {
        optionsBlock = `<div class="options">${q.options.map(o =>
            `<button class="opt" style="font-size:${fitFont(o, 1.3, 0.78)}" data-val="${o}">${o}</button>`).join('')}</div>`;
    }

    const diffTag = state.difficulty ? `<span style="text-transform:capitalize">${state.difficulty}</span> · ` : '';
    const streakTag = (state.streak || 0) >= 3 ? ` <span title="Streak">🔥${state.streak}</span>` : '';

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
      <button class="next-btn" id="nextBtn" style="background:${s.color}" ${q.isWriting ? '' : 'disabled'}>Next</button>
    </div>
  `;
}

function attachQuestion() {
    document.getElementById('backBtn')?.addEventListener('click', () => { state = null; render(); });
    const q = state.questions[state.index];
    const fb = document.getElementById('fb');
    const nextBtn = document.getElementById('nextBtn');

    if (q.isWriting) {
        const writingInput = document.getElementById('writingInput');
        writingInput?.addEventListener('input', () => {
            nextBtn.disabled = !writingInput.value.trim();
        });

        nextBtn?.addEventListener('click', () => {
            markQuestionAnswered(q);
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
        return;
    }

    const optionsContainer = document.querySelector('.options');
    let locked = false;

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
    window.getQuestionKey = getQuestionKey;
    window.filterAnsweredQuestions = filterAnsweredQuestions;
    window.markQuestionAnswered = markQuestionAnswered;
    window.buildQuestionSetForProfile = buildQuestionSetForProfile;
    window.initializeWorksheetState = initializeWorksheetState;
    window.getSubjectProgressText = getSubjectProgressText;
}

const READING_STORIES = {
    english: [
        { title: 'The Lost Kitten', text: 'Once upon a time, a little kitten got lost in the big park. It was scared and meowed loudly. A kind girl heard the kitten and looked for it. Under a big tree, she found the scared kitten. The girl took the kitten home and gave it milk. The kitten was happy and safe.', questions: [
            { prompt: 'Where did the kitten get lost?', options: ['park', 'school', 'home'], answer: 'park' },
            { prompt: 'Who helped the kitten?', options: ['a boy', 'a girl', 'a cat'], answer: 'a girl' },
            { prompt: 'What did the girl give the kitten?', options: ['water', 'milk', 'food'], answer: 'milk' }
        ] },
        { title: 'The Brave Little Bear', text: 'A little bear wanted to be brave like the big bears. He was small and often scared. One day, he saw his friend stuck in mud. The little bear did not run away. He helped his friend get out of the mud. All the bears cheered for him. The little bear learned that being brave does not mean being big.', questions: [
            { prompt: 'Who was stuck in the mud?', options: ['the big bear', 'the little bear', 'his friend'], answer: 'his friend' },
            { prompt: 'What did the little bear learn?', options: ['to be big', 'to be brave is not about size', 'to run away'], answer: 'to be brave is not about size' }
        ] },
        { title: 'The Rainbow Fish', text: 'A beautiful fish lived in the ocean with shiny scales. Other fish wanted to play with him, but he did not share his scales. The fish was lonely. One day, an old fish told him that sharing brings happiness. The rainbow fish started to share his scales with friends. Soon, many fish had shiny scales and played together happily.', questions: [
            { prompt: 'Why was the fish lonely?', options: ['he was small', 'he did not share', 'he was shy'], answer: 'he did not share' },
            { prompt: 'What made the fish happy?', options: ['being alone', 'sharing with friends', 'getting more scales'], answer: 'sharing with friends' }
        ] },
        { title: 'The Sleepy Dragon', text: 'A dragon lived in a cave high on a mountain. He was always very sleepy and liked to nap. One day, a brave knight came to the cave. But when the knight saw the dragon, he was not scary at all. The dragon was so sleepy, he could barely keep his eyes open. The knight sat down and they became friends. They both liked to nap together.', questions: [
            { prompt: 'Where did the dragon live?', options: ['in a cave', 'in a house', 'by the sea'], answer: 'in a cave' },
            { prompt: 'What happened when the knight met the dragon?', options: ['they fought', 'they became friends', 'the dragon ran away'], answer: 'they became friends' }
        ] },
        { title: 'The Little Seed', text: 'A tiny seed fell from a big tree. It landed in the dark soil. The seed was afraid of the dark. But then it felt the warmth of the sun and the water from the rain. The seed started to grow. It grew into a strong plant with big green leaves. The little seed was now helping other small creatures find shade.', questions: [
            { prompt: 'What was the seed afraid of?', options: ['the dark', 'the rain', 'the sun'], answer: 'the dark' },
            { prompt: 'What helped the seed grow?', options: ['only sun', 'only water', 'sun and water'], answer: 'sun and water' }
        ] },
        { title: 'The Friendly Cloud', text: 'A cloud floated in the blue sky. It was lonely because all the other clouds were busy. One day, the wind pushed the lonely cloud to where other clouds were. The clouds played together and made shapes. They became the best of friends. When it was time to rain, they all danced together in the sky.', questions: [
            { prompt: 'Why was the cloud lonely?', options: ['it was too small', 'the other clouds were busy', 'it did not know how to fly'], answer: 'the other clouds were busy' },
            { prompt: 'What did the clouds do together?', options: ['rained', 'played and made shapes', 'disappeared'], answer: 'played and made shapes' }
        ] }
    ],
    tagalog: [
        { title: 'Ang Nawala na Kuting', text: 'Noong unang panahon, ang isang kuting ay nawala sa malaking parke. Natakot ito at sumigaw ng malakas. Ang isang mabuting babae ay narinig ang kuting at naghahanap sa kanya. Sa ilalim ng malaking puno, nahanap niya ang kuting. Dala niya ito sa bahay at nagbigay ng gatas. Ang kuting ay masaya at ligtas.', questions: [
            { prompt: 'Saan nawala ang kuting?', options: ['parke', 'paaralan', 'bahay'], answer: 'parke' },
            { prompt: 'Sino ang tumulong sa kuting?', options: ['isang lalaki', 'isang babae', 'isang pusa'], answer: 'isang babae' },
            { prompt: 'Ano ang ibinigay sa kuting?', options: ['tubig', 'gatas', 'pagkain'], answer: 'gatas' }
        ] },
        { title: 'Ang Matapang na Maliliit na Oso', text: 'Ang isang maliliit na oso ay nais na maging matapang tulad ng malalaking oso. Siya ay maliit at takot. Isang araw, nakita niya ang kanyang kaibigan na naliligaw sa putik. Ang maliit na oso ay hindi tumakas. Tinulungan niya ang kanyang kaibigan. Lahat ng oso ay pumapalakpak para sa kanya.', questions: [
            { prompt: 'Sino ang naligaw sa putik?', options: ['ang malaking oso', 'ang maliit na oso', 'ang kanyang kaibigan'], answer: 'ang kanyang kaibigan' },
            { prompt: 'Ano ang natutunan ng maliit na oso?', options: ['matapang ang magpapatay', 'ang pagiging matapang ay hindi tungkol sa laki', 'hindi dapat tumulong'], answer: 'ang pagiging matapang ay hindi tungkol sa laki' }
        ] },
        { title: 'Ang Bahaghari na Isda', text: 'Ang isang magandang isda ay nabuhay sa karagatan. Mayroon siyang makintab na kaliskis. Gustong laruin siya ng iba pang isda, pero ayaw niya ibahagi. Nag-iisa ang isda. Isang araw, sinabi ng isang luma na isda na ang pagbahagi ang nagdudulot ng kaligayahan. Nagsimulang ibahagi ang isda ang kanyang kaliskis sa mga kaibigan.', questions: [
            { prompt: 'Bakit nag-iisa ang isda?', options: ['maliit siya', 'hindi siya nakibahagi', 'takot siya'], answer: 'hindi siya nakibahagi' },
            { prompt: 'Ano ang nakapagpapasaya sa isda?', options: ['pag-iisa', 'pagbahagi sa kaibigan', 'pagkain'], answer: 'pagbahagi sa kaibigan' }
        ] }
    ]
};

const WRITING_PROMPTS = {
    easy: [
        'Write a sentence about your favorite animal.',
        'Write a sentence about your best friend.',
        'Write a sentence about your favorite food.',
        'Write a sentence about your family.',
        'Write a sentence about your school.',
        'Write a sentence about something that makes you happy.',
        'Write a sentence about your favorite color.',
        'Write a sentence about what you like to do.'
    ],
    medium: [
        'Write a paragraph about your dream vacation.',
        'Write a paragraph about your favorite book.',
        'Write a paragraph about your best day ever.',
        'Write a paragraph about your favorite season.',
        'Write a paragraph about what you want to be when you grow up.',
        'Write a paragraph about a fun adventure you had.',
        'Write a paragraph about your favorite hobby.',
        'Write a paragraph about a place you would like to visit.'
    ],
    hard: [
        'Write a story about a magical adventure.',
        'Write a story about a mystery that needs solving.',
        'Write a story about a friendship that overcame challenges.',
        'Write a story about discovering something new.',
        'Write a story about helping someone in need.',
        'Write a story about traveling to a new land.',
        'Write a story about making a new friend.',
        'Write a story about overcoming a fear.'
    ]
};

function buildReading(language = 'english') {
    const stories = READING_STORIES[language] || READING_STORIES.english;
    const selectedStories = shuffle(stories).slice(0, 5);
    const allQuestions = [];

    selectedStories.forEach(story => {
        story.questions.forEach(q => {
            allQuestions.push({
                prompt: q.prompt,
                stageHTML: `<div class="story-container"><div class="story-text"><strong>${story.title}</strong><p>${story.text}</p></div></div>`,
                options: shuffle(q.options),
                answer: q.answer,
                isReading: true,
                _key: `reading_${language}_${story.title}_${q.prompt}`
            });
        });
    });

    return allQuestions.slice(0, 20);
}

function buildWriting(difficulty = 'medium') {
    const level = difficulty || 'medium';
    const prompts = WRITING_PROMPTS[level] || WRITING_PROMPTS.medium;
    const selectedPrompts = shuffle(prompts).slice(0, 5);

    return selectedPrompts.map((prompt, idx) => ({
        prompt,
        stageHTML: '',
        options: [],
        answer: prompt,
        isWriting: true,
        _key: `writing_${level}_${idx}_${prompt}`
    }));
}

if (typeof window !== 'undefined') {
    window.READING_STORIES = READING_STORIES;
    window.WRITING_PROMPTS = WRITING_PROMPTS;
    window.buildReading = buildReading;
    window.buildWriting = buildWriting;
}
