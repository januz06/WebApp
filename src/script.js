import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";

const auth = getAuth();

/* ---------------- Storage layer ---------------- */
let profiles = [];
let activeProfileId = null;
let storageReady = false;
let pendingMathKey = null;

function persist() {
    const user = auth.currentUser;
    if (user) {
        db.ref('users/' + user.uid).set({
            profiles: profiles,
            activeProfileId: activeProfileId
        }).catch(e => console.error("Firebase persist error:", e));
    } else {
        try { localStorage.setItem('la_profiles_v1', JSON.stringify({ profiles })); } catch (e) { }
    }
}

function initStorage() {
    onAuthStateChanged(auth,async (user) => {
        if (user) {
            try {
                const snapshot = await db.ref('users/' + user.uid).once('value');
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    profiles = data.profiles || [];
                    activeProfileId = data.activeProfileId || null;
                } else {
                    profiles = [];
                    activeProfileId = null;
                }
            } catch (e) {
                console.error("Firebase read error:", e);
                profiles = [];
                activeProfileId = null;
            }
        } else {
            try {
                const raw = localStorage.getItem('la_profiles_v1');
                profiles = raw ? (JSON.parse(raw).profiles || []) : [];
            } catch (e) { profiles = []; }
            try { activeProfileId = localStorage.getItem('la_active_profile'); } catch (e) { }
        }

        if (activeProfileId && !profiles.find(p => p.id === activeProfileId)) activeProfileId = null;
        storageReady = true;
        render();
    });
}

function setActiveProfile(id) {
    activeProfileId = id;
    const user = auth.currentUser;
    if (user) {
        db.ref('users/' + user.uid + '/activeProfileId').set(id).catch(e => console.error(e));
    } else {
        try { localStorage.setItem('la_active_profile', id); } catch (e) { }
    }
}

function activeProfile() { return profiles.find(p => p.id === activeProfileId) || null; }

/* ---------------- Auth Functions ---------------- */
async function loginUser(email, password) {
    await auth.signInWithEmailAndPassword(email, password);
}

async function logoutUser() {
    try {
        showLoading();
        // Clear any pending session
        clearSession();
        
        // Sign out from Firebase
        await signOut(auth);
        
        // Clear local storage
        localStorage.removeItem('la_profiles_v1');
        localStorage.removeItem('la_active_profile');
        
        // Reset state
        activeProfileId = null;
        profiles = [];
        storageReady = false;
        state = null;
        showDashboard = false;
        
        render();
    } catch (error) {
        console.error("Logout failed:", error);
        storageReady = true;
        renderError("Failed to logout. Please try again."); 
    }
}

function showLoading() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="loading-wrap">
            <h2>Logging out...</h2>
            <div class="spinner"></div>
        </div>
    `;
}

function renderError(message) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="error-message">
            <h2>Oops!</h2>
            <p>${message}</p>
            <button onclick="location.reload()">Try Again</button>
        </div>
    `;
}

/* ---------------- Avatars ---------------- */
const ANIMAL_ICONS = [
  '<i class="fa-solid fa-dog"></i>', 
  '<i class="fa-solid fa-cat"></i>', 
  '<i class="fa-solid fa-fish"></i>', 
  '<i class="fa-solid fa-horse"></i>', 
  '<i class="fa-solid fa-spider"></i>', 
  '<i class="fa-solid fa-crow"></i>', 
  '<i class="fa-solid fa-frog"></i>', 
  '<i class="fa-solid fa-hippo"></i>', 
  '<i class="fa-solid fa-otter"></i>', 
  '<i class="fa-solid fa-dragon"></i>'
];

const PERSON_ICONS = [
  '<i class="fa-solid fa-child"></i>', 
  '<i class="fa-solid fa-child-dress"></i>', 
  '<i class="fa-solid fa-user"></i>'
];
const AVATARS = [...PERSON_ICONS, ...ANIMAL_ICONS];

function recordSession(subjectKey, subjectName, difficulty, correct, total) {
    const p = activeProfile();
    if (!p) return;
    p.history = p.history || [];
    p.history.push({ date: new Date().toISOString(), subject: subjectKey, subjectName, difficulty: difficulty || null, correct, total });
    if (p.history.length > 60) p.history = p.history.slice(p.history.length - 60);
    persist();
}

function saveSession() {
    const p = activeProfile();
    if (!p || !state) return;
    p.inProgress = {
        key: state.key,
        color: state.color,
        difficulty: state.difficulty || null, // This will handle undefined difficulty
        questions: state.questions,
        index: state.index,
        correct: state.correct,
        streak: state.streak || 0
    };
    persist();
}

function clearSession() {
    const p = activeProfile();
    if (!p) return;
    p.inProgress = null;
    persist();
}

/* ---- Fun stuff: sounds, phrases, confetti ---- */
let audioCtx = null;
function beep(freq, dur, type) {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { }
}
function playCorrect() { beep(880, 0.12); setTimeout(() => beep(1175, 0.15), 90); }
function playWrong() { beep(220, 0.18, 'sawtooth'); }
function playFinish() { beep(660, 0.1); setTimeout(() => beep(880, 0.1), 110); setTimeout(() => beep(1100, 0.22), 220); }

const GOOD_PHRASES = ["Great job! 🎉", "Awesome! ⭐", "You got it! 🙌", "Nailed it! 🚀", "Super! 🌟", "Brilliant! 💫", "Way to go! 🎊", "Fantastic! 🥳"];
const BAD_PHRASES = ["Nice try! Here's the answer.", "Almost! Keep going 💪", "So close! On to the next one.", "Good effort! You'll get the next.", "Not quite — let's keep going!"];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function launchConfetti() {
    const colors = ['#FF6F59', '#1FAE9C', '#8B5CF6', '#F4A100', '#3B82C4', '#2FA84F'];
    for (let i = 0; i < 28; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = (1.3 + Math.random() * 1.3) + 's';
        el.style.animationDelay = (Math.random() * 0.3) + 's';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }
}

/* ---------------- Content ---------------- */
const SUBJECTS = {
    letters: { name: "Letters", tag: "Alphabet", icon: "🔤", color: "var(--coral)", build: buildLetters },
    numbers: { name: "Counting", tag: "Numbers", icon: "🔢", color: "var(--teal)", build: buildCounting },
    shapes: { name: "Shapes & Colors", tag: "Match it", icon: "🔺", color: "var(--violet)", build: buildShapes },
    mathYoung: { name: "Math Basics", tag: "Add & count", icon: "➕", color: "var(--amber)", build: buildMathYoung },
    math: { name: "Math", tag: "Operations", icon: "🧮", color: "var(--amber)", isMathMenu: true },
    addition: { name: "Addition", tag: "Math", icon: "➕", color: "var(--amber)", build: buildAddition },
    subtraction: { name: "Subtraction", tag: "Math", icon: "➖", color: "var(--coral)", build: buildSubtraction },
    multiplication: { name: "Multiplication", tag: "Math", icon: "✖️", color: "var(--teal)", build: buildMultiplication },
    division: { name: "Division", tag: "Math", icon: "➗", color: "var(--violet)", build: buildDivision },
    english: { name: "English", tag: "Words & grammar", icon: "📖", color: "var(--sky)", build: buildEnglish },
    science: { name: "Science", tag: "Explore the world", icon: "🔬", color: "var(--leaf)", build: buildScience },
    reading: { name: "Reading", tag: "Stories", icon: "📚", color: "var(--indigo)", build: buildReading },
    writing: { name: "Writing", tag: "Practice", icon: "✍️", color: "var(--indigo)", build: buildWriting }
};

const AGE_GROUPS = {
    young: { label: "Little Learners", range: "Ages 4–6", icon: "🧸", subjects: ["letters", "numbers", "shapes", "mathYoung"] },
    elementary: { label: "Elementary", range: "Ages 6–8+", icon: "🎒", subjects: ["math", "english", "science", "reading", "writing"] }
};

const DIFFICULTIES = [
    { key: "easy", label: "Easy", blurb: "Warm up" },
    { key: "medium", label: "Medium", blurb: "Just right" },
    { key: "hard", label: "Hard", blurb: "Challenge me" }
];

let pendingSubjectKey = null;
let state = null;
let profileDraft = null;
let focusNameOnRender = false;
let showDashboard = false;

const QUESTIONS_PER_SET = 20;

function shuffle(arr) { return arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]); }

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

function currentAgeGroup() { const p = activeProfile(); return p ? p.ageGroup : null; }

function buildLetters() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    return buildUnique(QUESTIONS_PER_SET, () => {
        const L = letters[Math.floor(Math.random() * letters.length)];
        const opts = shuffle([L, ...shuffle(letters.filter(x => x !== L)).slice(0, 3)]);
        return {
            prompt: `Click the letter <span style="color:var(--coral)">${L}</span>`,
            stageHTML: `<div class="stage-letter" style="visibility:hidden">.</div>`, options: opts, answer: L, _key: L
        };
    });
}

const OBJ_EMOJI = ["🍎", "⭐", "🐝", "🍓", "🎈", "🐟", "🍪", "🌸"];
function buildCounting() {
    return buildUnique(QUESTIONS_PER_SET, () => {
        const n = 2 + Math.floor(Math.random() * 13);
        const e = OBJ_EMOJI[Math.floor(Math.random() * OBJ_EMOJI.length)];
        const opts = shuffle([n, ...shuffle([n - 2, n - 1, n + 1, n + 2].filter(x => x > 0 && x !== n)).slice(0, 3)]).slice(0, 4);
        return { prompt: "How many do you see?", stageHTML: Array(n).fill(`<span class="obj">${e}</span>`).join(""), options: opts, answer: n, _key: `${n}_${e}` };
    });
}

const SHAPES = [
    { name: "circle", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="${c}"/></svg>` },
    { name: "square", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="6" fill="${c}"/></svg>` },
    { name: "triangle", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><polygon points="32,6 60,58 4,58" fill="${c}"/></svg>` },
    { name: "star", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><polygon points="32,4 40,24 62,24 44,38 50,60 32,47 14,60 20,38 2,24 24,24" fill="${c}"/></svg>` },
    { name: "rectangle", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><rect x="2" y="16" width="60" height="32" rx="6" fill="${c}"/></svg>` },
    { name: "diamond", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><polygon points="32,2 62,32 32,62 2,32" fill="${c}"/></svg>` },
    { name: "heart", svg: (c) => `<svg class="shape" viewBox="0 0 64 64"><path d="M32 58 C10 42 2 28 2 18 C2 8 10 2 18 2 C25 2 30 6 32 12 C34 6 39 2 46 2 C54 2 62 8 62 18 C62 28 54 42 32 58 Z" fill="${c}"/></svg>` }
];
const COLORS = [["red", "#E4453A"], ["blue", "#3B82C4"], ["green", "#2FA84F"], ["yellow", "#F0B429"], ["purple", "#8B5CF6"]];
function buildShapes() {
    return buildUnique(QUESTIONS_PER_SET, () => {
        const askColor = Math.random() < 0.65;
        const shapeChoice = shuffle(SHAPES).slice(0, 4);
        const [cName, cHex] = COLORS[Math.floor(Math.random() * COLORS.length)];
        if (askColor) {
            const target = shapeChoice[0];
            const otherColors = shuffle(COLORS.filter(c => c[1] !== cHex)).slice(0, 3);
            const optionsHTML = shuffle(shapeChoice.map((s, idx) => {
                const color = idx === 0 ? cHex : otherColors[idx - 1][1];
                return { name: s.name, color };
            }));
            return {
                prompt: `Click the <span style="color:${cHex}">${cName}</span> shape`, stageHTML: "",
                optionsHTML, isShapeQ: true, answer: target.name, _key: `c_${cName}_${target.name}`
            };
        }
        const target = shapeChoice[0];
        return {
            prompt: `Click the ${target.name}`, stageHTML: "",
            optionsHTML: shuffle(shapeChoice.map((s) => ({ name: s.name, color: "#8A7CA8" }))), isShapeQ: true, answer: target.name, _key: `s_${target.name}`
        };
    });
}

function buildMathYoung() {
    return buildUnique(QUESTIONS_PER_SET, () => {
        const add = Math.random() < 0.6;
        let a, b, ans, text, type;
        if (add) { a = 1 + Math.floor(Math.random() * 9); b = 1 + Math.floor(Math.random() * 9); ans = a + b; text = `${a} + ${b} = ?`; type = 'a'; }
        else { a = 2 + Math.floor(Math.random() * 9); b = 1 + Math.floor(Math.random() * a); ans = a - b; text = `${a} − ${b} = ?`; type = 's'; }
        const opts = shuffle([ans, ...shuffle([ans - 2, ans - 1, ans + 1, ans + 2].filter(x => x >= 0 && x !== ans)).slice(0, 3)]).slice(0, 4);
        return { prompt: text, stageHTML: "", options: opts, answer: ans, _key: `${type}_${a}_${b}` };
    });
}

function numOptions(ans, spread) {
    let cand = Array.from(new Set(spread.map(d => ans + d).filter(x => x >= 0 && x !== ans)));
    cand = shuffle(cand).slice(0, 3);
    let guard = 0;
    while (cand.length < 3 && guard < 20) {
        guard++;
        const v = ans + (Math.floor(Math.random() * 10) - 5);
        if (v >= 0 && v !== ans && !cand.includes(v)) cand.push(v);
    }
    return shuffle([ans, ...cand]);
}

function buildAddition(difficulty) {
    const level = difficulty || "medium";
    return buildUnique(QUESTIONS_PER_SET, () => {
        let a, b;
        if (level === "easy") { a = 1 + Math.floor(Math.random() * 8); b = 1 + Math.floor(Math.random() * (9 - a)); }
        else if (level === "hard") { a = 10 + Math.floor(Math.random() * 40); b = 10 + Math.floor(Math.random() * 40); }
        else { a = 1 + Math.floor(Math.random() * 12); b = 1 + Math.floor(Math.random() * 8); }
        const ans = a + b;
        return { prompt: `${a} + ${b} = ?`, stageHTML: "", options: numOptions(ans, [-3, -2, -1, 1, 2, 3]), answer: ans, _key: `add_${a}_${b}` };
    });
}

function buildSubtraction(difficulty) {
    const level = difficulty || "medium";
    return buildUnique(QUESTIONS_PER_SET, () => {
        let a, b;
        if (level === "easy") { a = 2 + Math.floor(Math.random() * 8); b = 1 + Math.floor(Math.random() * (a - 1)); }
        else if (level === "hard") { a = 20 + Math.floor(Math.random() * 30); b = 1 + Math.floor(Math.random() * (a - 1)); }
        else { a = 10 + Math.floor(Math.random() * 10); b = 1 + Math.floor(Math.random() * (a - 1)); }
        const ans = a - b;
        return { prompt: `${a} − ${b} = ?`, stageHTML: "", options: numOptions(ans, [-3, -2, -1, 1, 2, 3]), answer: ans, _key: `sub_${a}_${b}` };
    });
}

function buildMultiplication(difficulty) {
    const level = difficulty || "medium";
    return buildUnique(QUESTIONS_PER_SET, () => {
        let a, b;
        if (level === "hard") { a = 2 + Math.floor(Math.random() * 8); b = 2 + Math.floor(Math.random() * 8); }
        else { a = 2 + Math.floor(Math.random() * 4); b = 2 + Math.floor(Math.random() * 4); }
        const ans = a * b;
        return { prompt: `${a} × ${b} = ?`, stageHTML: "", options: numOptions(ans, [-4, -2, -1, 1, 2, 4]), answer: ans, _key: `mul_${a}_${b}` };
    });
}

function buildDivision(difficulty) {
    const level = difficulty || "medium";
    return buildUnique(QUESTIONS_PER_SET, () => {
        let b, q;
        if (level === "hard") { b = 2 + Math.floor(Math.random() * 8); q = 2 + Math.floor(Math.random() * 8); }
        else { b = 2 + Math.floor(Math.random() * 4); q = 2 + Math.floor(Math.random() * 4); }
        const a = b * q;
        return { prompt: `${a} ÷ ${b} = ?`, stageHTML: "", options: numOptions(q, [-2, -1, 1, 2, 3]), answer: q, _key: `div_${a}_${b}` };
    });
}

const OPPOSITE_PAIRS = [
    { level: "easy", a: "big", b: "small" }, { level: "easy", a: "hot", b: "cold" }, { level: "easy", a: "up", b: "down" },
    { level: "easy", a: "fast", b: "slow" }, { level: "easy", a: "happy", b: "sad" }, { level: "easy", a: "day", b: "night" },
    { level: "easy", a: "wet", b: "dry" }, { level: "easy", a: "full", b: "empty" }, { level: "easy", a: "in", b: "out" },
    { level: "easy", a: "open", b: "shut" }, { level: "easy", a: "loud", b: "quiet" }, { level: "easy", a: "clean", b: "dirty" },
    { level: "medium", a: "old", b: "new" }, { level: "medium", a: "push", b: "pull" }, { level: "medium", a: "light", b: "dark" },
    { level: "medium", a: "win", b: "lose" }, { level: "medium", a: "buy", b: "sell" }, { level: "medium", a: "early", b: "late" },
    { level: "medium", a: "near", b: "far" }, { level: "medium", a: "true", b: "false" }, { level: "medium", a: "begin", b: "end" },
    { level: "medium", a: "remember", b: "forget" },
    { level: "hard", a: "ancient", b: "modern" }, { level: "hard", a: "brave", b: "cowardly" }, { level: "hard", a: "generous", b: "stingy" },
    { level: "hard", a: "increase", b: "decrease" }, { level: "hard", a: "arrive", b: "depart" }, { level: "hard", a: "visible", b: "invisible" },
    { level: "hard", a: "permanent", b: "temporary" }, { level: "hard", a: "expand", b: "shrink" }, { level: "hard", a: "victory", b: "defeat" },
    { level: "hard", a: "raise", b: "lower" }
];
const SYNONYM_PAIRS = [
    { level: "easy", a: "happy", b: "glad" }, { level: "easy", a: "quick", b: "fast" }, { level: "easy", a: "small", b: "tiny" },
    { level: "easy", a: "big", b: "large" }, { level: "easy", a: "pretty", b: "nice" }, { level: "easy", a: "jump", b: "hop" },
    { level: "easy", a: "scared", b: "afraid" }, { level: "easy", a: "look", b: "see" },
    { level: "medium", a: "begin", b: "start" }, { level: "medium", a: "silent", b: "quiet" }, { level: "medium", a: "joyful", b: "cheerful" },
    { level: "medium", a: "angry", b: "mad" }, { level: "medium", a: "tired", b: "sleepy" }, { level: "medium", a: "smart", b: "clever" },
    { level: "medium", a: "funny", b: "silly" },
    { level: "hard", a: "enormous", b: "huge" }, { level: "hard", a: "furious", b: "enraged" }, { level: "hard", a: "exhausted", b: "drained" },
    { level: "hard", a: "brilliant", b: "intelligent" }, { level: "hard", a: "gigantic", b: "colossal" }, { level: "hard", a: "delighted", b: "thrilled" },
    { level: "hard", a: "terrified", b: "petrified" }, { level: "hard", a: "unique", b: "unmatched" }
];
const ENGLISH_EXTRA = [
    { level: "easy", prompt: "Which word rhymes with 'sun'?", options: ["fun", "cup", "dog", "cat"], answer: "fun" },
    { level: "easy", prompt: "Which word rhymes with 'cat'?", options: ["hat", "dog", "sun", "cup"], answer: "hat" },
    { level: "easy", prompt: "Which word rhymes with 'bee'?", options: ["tree", "car", "fish", "book"], answer: "tree" },
    { level: "medium", prompt: "Which is a naming word (noun)?", options: ["dog", "run", "blue", "quickly"], answer: "dog" },
    { level: "medium", prompt: "Which is a doing word (verb)?", options: ["jump", "happy", "table", "red"], answer: "jump" },
    { level: "medium", prompt: "Which word is spelled correctly?", options: ["friend", "freind", "frend", "fiend"], answer: "friend" },
    { level: "medium", prompt: "Which word means the opposite of 'day'?", options: ["night", "light", "sun", "morning"], answer: "night" },
    { level: "hard", prompt: "Which word is a describing word (adjective)?", options: ["bright", "run", "quickly", "table"], answer: "bright" },
    { level: "hard", prompt: "What is the correct plural of 'child'?", options: ["children", "childs", "childes", "child"], answer: "children" },
    { level: "hard", prompt: "Which sentence uses punctuation correctly?", options: ["I like dogs.", "i like dogs", "I like dogs", "I like dogs,"], answer: "I like dogs." }
];
function oppositeQuestions(level) {
    return OPPOSITE_PAIRS.filter(p => p.level === level).map(p => {
        const pool = OPPOSITE_PAIRS.filter(x => x !== p).map(x => x.b);
        const opts = shuffle([p.b, ...shuffle(pool).slice(0, 3)]);
        return { prompt: `What is the opposite of '${p.a}'?`, stageHTML: "", options: opts, answer: p.b, _key: `opp_${p.a}` };
    });
}
function synonymQuestions(level) {
    return SYNONYM_PAIRS.filter(p => p.level === level).map(p => {
        const pool = SYNONYM_PAIRS.filter(x => x !== p).map(x => x.b);
        const opts = shuffle([p.b, ...shuffle(pool).slice(0, 3)]);
        return { prompt: `Which word means the same as '${p.a}'?`, stageHTML: "", options: opts, answer: p.b, _key: `syn_${p.a}` };
    });
}
function buildEnglish(difficulty) {
    const level = difficulty || "medium";
    const pool = [
        ...oppositeQuestions(level),
        ...synonymQuestions(level),
        ...ENGLISH_EXTRA.filter(q => q.level === level).map(q => ({ ...q, options: shuffle(q.options), _key: q.prompt }))
    ];
    const seen = new Set();
    const uniquePool = pool.filter(q => {
        const key = q._key || q.prompt;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return shuffle(uniquePool).slice(0, QUESTIONS_PER_SET)
        .map(q => ({ prompt: q.prompt, stageHTML: "", options: shuffle(q.options), answer: q.answer }));
}

const SCIENCE_POOL = [
    { level: "easy", prompt: "Which of these is a mammal?", options: ["dog", "fish", "frog", "bee"], answer: "dog" },
    { level: "easy", prompt: "What do plants need to grow?", options: ["sunlight", "ice", "rocks", "sand"], answer: "sunlight" },
    { level: "easy", prompt: "What is frozen water called?", options: ["ice", "steam", "rain", "cloud"], answer: "ice" },
    { level: "easy", prompt: "Which planet do we live on?", options: ["Earth", "Mars", "the Moon", "the Sun"], answer: "Earth" },
    { level: "easy", prompt: "Which season comes right after winter?", options: ["spring", "summer", "fall", "autumn"], answer: "spring" },
    { level: "easy", prompt: "What do bees make?", options: ["honey", "milk", "silk", "wax"], answer: "honey" },
    { level: "easy", prompt: "Which animal says 'moo'?", options: ["cow", "cat", "duck", "pig"], answer: "cow" },
    { level: "easy", prompt: "What do we call baby dogs?", options: ["puppies", "kittens", "cubs", "chicks"], answer: "puppies" },
    { level: "easy", prompt: "Which of these can fly?", options: ["a bird", "a fish", "a dog", "a snake"], answer: "a bird" },
    { level: "easy", prompt: "What color is the sky on a clear day?", options: ["blue", "green", "red", "brown"], answer: "blue" },
    { level: "easy", prompt: "Which of these lives in water?", options: ["a fish", "a cat", "a bird", "a rabbit"], answer: "a fish" },
    { level: "easy", prompt: "Which season is the coldest?", options: ["winter", "summer", "spring", "fall"], answer: "winter" },
    { level: "easy", prompt: "What do cows give us to drink?", options: ["milk", "juice", "water", "soda"], answer: "milk" },
    { level: "easy", prompt: "Which of these is a fruit?", options: ["apple", "carrot", "potato", "onion"], answer: "apple" },
    { level: "easy", prompt: "What falls from clouds when it rains?", options: ["water", "sand", "leaves", "snowflakes"], answer: "water" },
    { level: "easy", prompt: "Which animal has a very long neck?", options: ["giraffe", "pig", "dog", "cat"], answer: "giraffe" },
    { level: "easy", prompt: "What do we call a baby cat?", options: ["kitten", "puppy", "cub", "calf"], answer: "kitten" },
    { level: "easy", prompt: "Which of these is a vegetable?", options: ["carrot", "banana", "apple", "grape"], answer: "carrot" },
    { level: "easy", prompt: "What do plants grow from?", options: ["a seed", "a rock", "a leaf", "water alone"], answer: "a seed" },
    { level: "easy", prompt: "Which of these keeps you warm in winter?", options: ["a coat", "a fan", "an ice cube", "a swimsuit"], answer: "a coat" },
    { level: "medium", prompt: "How many legs does an insect have?", options: ["6", "4", "8", "2"], answer: "6" },
    { level: "medium", prompt: "What organ pumps blood in your body?", options: ["heart", "lungs", "brain", "stomach"], answer: "heart" },
    { level: "medium", prompt: "What gas do humans need to breathe?", options: ["oxygen", "carbon dioxide", "helium", "smoke"], answer: "oxygen" },
    { level: "medium", prompt: "Which of these floats on water?", options: ["a leaf", "a rock", "a coin", "a marble"], answer: "a leaf" },
    { level: "medium", prompt: "What are the three states of matter?", options: ["solid, liquid, gas", "hot, cold, warm", "big, small, medium", "fast, slow, still"], answer: "solid, liquid, gas" },
    { level: "medium", prompt: "Which of these is a source of light?", options: ["the Sun", "a rock", "a pillow", "a shoe"], answer: "the Sun" },
    { level: "medium", prompt: "What do we call animals that eat only plants?", options: ["herbivores", "carnivores", "omnivores", "predators"], answer: "herbivores" },
    { level: "medium", prompt: "Which organ helps you think?", options: ["brain", "heart", "lungs", "stomach"], answer: "brain" },
    { level: "medium", prompt: "What is the closest star to Earth?", options: ["the Sun", "the Moon", "Mars", "Polaris"], answer: "the Sun" },
    { level: "medium", prompt: "Which of these is NOT a living thing?", options: ["a rock", "a tree", "a dog", "a mushroom"], answer: "a rock" },
    { level: "medium", prompt: "What do we call water that has turned to gas?", options: ["vapor", "ice", "slush", "foam"], answer: "vapor" },
    { level: "medium", prompt: "Which of these animals is a reptile?", options: ["snake", "dog", "frog", "bird"], answer: "snake" },
    { level: "medium", prompt: "Which sense do we use to hear?", options: ["hearing", "sight", "taste", "smell"], answer: "hearing" },
    { level: "medium", prompt: "Which body part helps you smell?", options: ["nose", "ear", "hand", "foot"], answer: "nose" },
    { level: "medium", prompt: "What do we call animals that eat meat?", options: ["carnivores", "herbivores", "producers", "plants"], answer: "carnivores" },
    { level: "medium", prompt: "Which planet is known as the Red Planet?", options: ["Mars", "Venus", "Jupiter", "Saturn"], answer: "Mars" },
    { level: "medium", prompt: "What is the largest ocean on Earth?", options: ["the Pacific Ocean", "the Atlantic Ocean", "the Arctic Ocean", "the Indian Ocean"], answer: "the Pacific Ocean" },
    { level: "medium", prompt: "Which of these helps plants make their own food?", options: ["sunlight", "moonlight", "sand", "wind"], answer: "sunlight" },
    { level: "medium", prompt: "What do we call the study of living things?", options: ["biology", "geology", "astronomy", "chemistry"], answer: "biology" },
    { level: "medium", prompt: "Which of these animals hatches from an egg?", options: ["a chicken", "a dog", "a cat", "a horse"], answer: "a chicken" },
    { level: "hard", prompt: "What do plants use sunlight to make?", options: ["food (photosynthesis)", "sound", "soil", "ice"], answer: "food (photosynthesis)" },
    { level: "hard", prompt: "What is it called when water rises into the air as vapor?", options: ["evaporation", "condensation", "precipitation", "collection"], answer: "evaporation" },
    { level: "hard", prompt: "Which of these is a simple machine?", options: ["a lever", "a computer", "a battery", "a magnet"], answer: "a lever" },
    { level: "hard", prompt: "What does a caterpillar turn into?", options: ["a butterfly", "a bee", "a beetle", "a moth larva"], answer: "a butterfly" },
    { level: "hard", prompt: "Which organ helps you breathe?", options: ["lungs", "liver", "kidney", "stomach"], answer: "lungs" },
    { level: "hard", prompt: "What force pulls objects toward the Earth?", options: ["gravity", "friction", "magnetism", "electricity"], answer: "gravity" },
    { level: "hard", prompt: "What is the water-cycle step when water falls as rain?", options: ["precipitation", "evaporation", "condensation", "collection"], answer: "precipitation" },
    { level: "hard", prompt: "Which planet is closest to the Sun?", options: ["Mercury", "Venus", "Earth", "Mars"], answer: "Mercury" },
    { level: "hard", prompt: "What do we call animals with a backbone?", options: ["vertebrates", "invertebrates", "amphibians", "arachnids"], answer: "vertebrates" },
    { level: "hard", prompt: "Which gas do plants release during photosynthesis?", options: ["oxygen", "carbon dioxide", "nitrogen", "helium"], answer: "oxygen" },
    { level: "hard", prompt: "What is the hardest natural substance on Earth?", options: ["diamond", "gold", "granite", "iron"], answer: "diamond" },
    { level: "hard", prompt: "Which organ filters waste from your blood?", options: ["kidneys", "liver", "lungs", "skin"], answer: "kidneys" },
    { level: "hard", prompt: "What is the process of a caterpillar becoming a butterfly called?", options: ["metamorphosis", "evaporation", "photosynthesis", "pollination"], answer: "metamorphosis" },
    { level: "hard", prompt: "Which force slows down moving objects by rubbing against them?", options: ["friction", "gravity", "magnetism", "momentum"], answer: "friction" },
    { level: "hard", prompt: "What do we call the layer of gases around Earth?", options: ["the atmosphere", "the crust", "the core", "the mantle"], answer: "the atmosphere" },
    { level: "hard", prompt: "Which of these is a renewable energy source?", options: ["solar power", "coal", "oil", "natural gas"], answer: "solar power" },
    { level: "hard", prompt: "What is the freezing point of water in Celsius?", options: ["0°C", "10°C", "32°C", "100°C"], answer: "0°C" },
    { level: "hard", prompt: "Which part of a plant absorbs water from the soil?", options: ["the roots", "the leaves", "the petals", "the stem tip"], answer: "the roots" },
    { level: "hard", prompt: "What is the smallest unit of life called?", options: ["a cell", "an atom", "a molecule", "a tissue"], answer: "a cell" },
    { level: "hard", prompt: "Which of these is NOT a state of matter?", options: ["energy", "solid", "liquid", "gas"], answer: "energy" }
];
function buildScience(difficulty) {
    const level = difficulty || "medium";
    const filtered = SCIENCE_POOL.filter(q => q.level === level);
    const seen = new Set();
    const uniquePool = filtered.filter(q => {
        if (seen.has(q.prompt)) return false;
        seen.add(q.prompt);
        return true;
    });
    return shuffle(uniquePool).slice(0, QUESTIONS_PER_SET)
        .map(q => ({ prompt: q.prompt, stageHTML: "", options: shuffle(q.options), answer: q.answer }));
}

function buildReading(language = "english") {
    // Sample stories - you can expand this
    const stories = {
        english: [
            {
                title: "The Lost Kitten",
                text: "Once upon a time, a little kitten got lost in the big park. It was scared and meowed loudly. A kind girl heard the kitten and looked for it. Under a big tree, she found the scared kitten. The girl took the kitten home and gave it milk. The kitten was happy and safe.",
                questions: [
                    { prompt: "Where did the kitten get lost?", options: ["park", "school", "home"], answer: "park" },
                    { prompt: "Who helped the kitten?", options: ["a boy", "a girl", "a cat"], answer: "a girl" },
                    { prompt: "What did the girl give the kitten?", options: ["water", "milk", "food"], answer: "milk" }
                ]
            },
            // Add more English stories here
        ],
        tagalog: [
            {
                title: "Ang Nawawang Pusa",
                text: "Isang araw, isang maliit na pusa ang nawalan sa malaking hardin. Takot na takot ang pusa at nagmiyaw nang malakas. Narinig ng isang mabuting bata ang miyaw ng pusa at hinahanap ito. Sa ilalim ng malas na puno, nakita ng bata ang takot na pusa. Inuha ng bata ang pusa sa bahay at binigyan ito ng gatas. Masaya at ligtas na ang pusa.",
                questions: [
                    { prompt: "Saan nawalan ang pusa?", options: ["hardin", "eskwela", "bahay"], answer: "hardin" },
                    { prompt: " sino ang tumulong sa pusa?", options: ["isang lalaki", "isang bata", "isang matanda"], answer: "isang bata" },
                    { prompt: "Ano ang binigay sa pusa ng bata?", options: ["tubig", "gatas", "pagkain"], answer: "gatas" }
                ]
            },
            // Add more Tagalog stories here
        ]
    };

    const selectedStories = shuffle(stories[language]).slice(0, 5);
    const allQuestions = [];

    selectedStories.forEach(story => {
        story.questions.forEach(q => {
            allQuestions.push({
                prompt: q.prompt,
                stageHTML: `<div class="story-text">${story.text}</div><h3>${story.title}</h3>`,
                options: shuffle(q.options),
                answer: q.answer
            });
        });
    });

    return allQuestions;
}

function buildWriting(difficulty) {
    const level = difficulty || "medium";
    const writingPrompts = {
        easy: [
            "Write a sentence about your favorite animal.",
            "Write a sentence about your best friend.",
            "Write a sentence about your favorite food.",
            "Write a sentence about your family.",
            "Write a sentence about your school."
        ],
        medium: [
            "Write a paragraph about your dream vacation.",
            "Write a paragraph about your favorite book.",
            "Write a paragraph about your best day ever.",
            "Write a paragraph about your favorite season.",
            "Write a paragraph about what you want to be when you grow up."
        ],
        hard: [
            "Write a story about a magical adventure.",
            "Write a story about a mystery that needs solving.",
            "Write a story about a friendship that overcame challenges.",
            "Write a story about discovering something new.",
            "Write a story about helping someone in need."
        ]
    };

    const prompts = writingPrompts[level];
    const selectedPrompts = shuffle(prompts).slice(0, 5);

    return selectedPrompts.map((prompt, index) => ({
        prompt: prompt,
        stageHTML: `<div class="writing-prompt"><h3>Writing Prompt ${index + 1}</h3><p>${prompt}</p></div>`,
        options: [], // No multiple choice for writing
        answer: "", // No correct answer for writing
        isWriting: true
    }));
}

/* ---------------- Render ---------------- */
function render() {
    const app = document.getElementById('app');
    if (!storageReady) { app.innerHTML = `<div class="loading-wrap"><h2>Loading…</h2><p>Getting your profiles ready</p></div>`; return; }

    const user = auth.currentUser;
    if (!user) { renderAuth(); return; }

    if (profileDraft) { app.innerHTML = addProfileHTML(); attachAddProfile(); return; }
    if (!activeProfileId || !activeProfile()) { app.innerHTML = profileSelectHTML(); attachProfileSelect(); return; }
    if (showDashboard) { app.innerHTML = dashboardHTML(); attachDashboard(); return; }
    if (!state && currentAgeGroup() === "elementary" && pendingSubjectKey === "math" && !pendingMathKey) {
        app.innerHTML = mathMenuHTML();
        attachMathMenu();
        return;
    }
    if (!state && currentAgeGroup() === "elementary" && pendingSubjectKey && pendingMathKey) {
        app.innerHTML = difficultyHTML();
        attachDifficulty();
        return;
    }
    if (!state) {
        app.innerHTML = subjectHTML();
        attachSubject();
        return;
    }

    if (state.index >= state.questions.length) { app.innerHTML = doneHTML(); attachDone(); return; }
    app.innerHTML = questionHTML();
    attachQuestion();
}

function renderAuth() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="home-head" style="margin-top:40px">
        <h1>Learning Adventures</h1>
        <p>Login to sync your progress across devices!</p>
      </div>
      <div class="q-card" style="text-align:left; margin-top:20px;">
        <p class="field-label">Email</p>
        <input class="field" type="email" id="authEmail" placeholder="you@example.com">
        <p class="field-label" style="margin-top:10px">Password</p>
        <input class="field" type="password" id="authPassword" placeholder="Your password">
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
          <button class="next-btn" id="loginBtn" style="background:var(--violet)">Login</button>
          <button class="btn-secondary btn-full" id="registerBtn" style="padding:14px; border-radius:16px; font-weight:700; cursor:pointer;">Create Account</button>
        </div>
        <p id="authError" style="color:var(--feedback-bad-ink); margin-top:12px; font-size:.9rem;"></p>
      </div>
    `;

    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        try {
            await loginUser(email, password);
        } catch (error) {
            document.getElementById('authError').textContent = error.message;
        }
    });

    document.getElementById('registerBtn').addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;

        const result = await createAccount(email, password);

        if (result.success) {
            // Account created successfully
            render();
        } else {
            // Show error message
            document.getElementById('authError').textContent = result.error;
        }
    });

}

function profileChipHTML() {
    const p = activeProfile();
    if (!p) return "";
    return `<button class="profile-chip" id="chipBtn">
    <span class="mini-avatar">${p.avatar}</span> ${p.name}
  </button>`;
}

/* ---- Profile select / create ---- */
function profileSelectHTML() {
    let cards = profiles.map(p => `
    <button class="card profile-card" style="--c:var(--violet)" data-id="${p.id}">
      <span class="avatar-circle">${p.avatar}</span>
      <div><h3>${p.name}</h3><span class="tag">${(p.history || []).length} sessions</span></div>
    </button>
    <button class="back" style="margin-top:-10px;margin-bottom:14px;font-size:.8rem;padding:6px 10px" data-edit="${p.id}">✏️ Edit</button>`).join("");
    return `
    <div class="home-head">
      <h1>Learning Adventures</h1>
      <p>Who's practicing today?</p>
    </div>
    <div class="grid">
      ${cards}
      <button class="card" style="--c:var(--coral)" id="newProfileBtn">
        <div class="icon">➕</div><h3>Add profile</h3><span class="tag">New learner</span>
      </button>
    </div>
    <button class="back btn-full" id="logoutBtn" style="margin-top:24px">🚪 Logout</button>
  `;
}

// create profile
async function createAccount(email, password) {
    // Validate email format
    if (!email || !password) {
        return { success: false, error: "Email and password are required" };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { success: false, error: "The email address is badly formatted." };
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log("Account created successfully:", user.uid);
        return { success: true, user };
    } catch (error) {
        console.error("Error creating account:", error.message);
        return { success: false, error: error.message };
    }
}

function attachProfileSelect() {
    document.querySelectorAll('[data-id]').forEach(btn => {
        btn.addEventListener('click', () => { setActiveProfile(btn.dataset.id); state = null; render(); });
    });
    const nb = document.getElementById('newProfileBtn');
    if (nb) nb.addEventListener('click', () => { profileDraft = { name: "", avatar: AVATARS[0], ageGroup: null }; focusNameOnRender = true; render(); });
    document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const p = profiles.find(x => x.id === btn.dataset.edit);
            if (!p) return;
            profileDraft = { id: p.id, name: p.name, avatar: p.avatar, ageGroup: p.ageGroup };
            focusNameOnRender = true;
            render();
        });
    });
    document.getElementById('logoutBtn').addEventListener('click', () => { logoutUser(); });
}

function addProfileHTML() {
    let avatars = AVATARS.map(a => `
    <button class="avatar-opt ${a === profileDraft.avatar ? 'picked' : ''}" data-a="${a}">${a}</button>
  `).join("");
    let ageCards = Object.entries(AGE_GROUPS).map(([key, g]) => `
    <button class="card ${profileDraft.ageGroup === key ? 'picked-card' : ''}" style="--c:var(--violet)" data-age="${key}">
      <div class="icon">${g.icon}</div><h3>${g.label}</h3><span class="tag">${g.range}</span>
    </button>`).join("");
    const backBtn = profiles.length ? `<button class="back" id="cancelBtn">← Cancel</button>` : "";
    const canSave = profileDraft.ageGroup ? "" : "disabled";
    return `
    <div class="topbar">${backBtn}</div>
    <div class="home-head"><h1>${profileDraft.id ? 'Edit profile' : 'New profile'}</h1><p>Name, avatar, and age level</p></div>
    <p class="field-label">Name</p>
    <input class="field" id="nameInput" maxlength="16" placeholder="e.g. Emma" value="${profileDraft.name}">
    <p class="field-label" style="margin-top:14px">Avatar</p>
    <div class="avatar-grid">${avatars}</div>
    <p class="field-label" style="margin-top:14px">Age level</p>
    <div class="grid" style="margin-bottom:20px">${ageCards}</div>
    <button class="next-btn" id="saveProfileBtn" style="background:var(--violet)" ${canSave}>${profileDraft.id ? 'Save changes' : 'Create profile'}</button>
  `;
}
function attachAddProfile() {
    const cancel = document.getElementById('cancelBtn');
    if (cancel) cancel.addEventListener('click', () => { profileDraft = null; render(); });
    const nameInput = document.getElementById('nameInput');
    nameInput.addEventListener('input', () => { profileDraft.name = nameInput.value; });
    document.querySelectorAll('.avatar-opt').forEach(btn => {
        btn.addEventListener('click', () => { profileDraft.avatar = btn.dataset.a; render(); });
    });
    document.querySelectorAll('[data-age]').forEach(btn => {
        btn.addEventListener('click', () => { profileDraft.ageGroup = btn.dataset.age; render(); });
    });
    const saveBtn = document.getElementById('saveProfileBtn');
    saveBtn.addEventListener('click', () => {
        if (!profileDraft.ageGroup) return;
        const name = (profileDraft.name || "").trim() || "Learner";
        if (profileDraft.id) {
            const p = profiles.find(x => x.id === profileDraft.id);
            if (p) { p.name = name; p.avatar = profileDraft.avatar; p.ageGroup = profileDraft.ageGroup; }
        } else {
            const p = { id: 'p_' + Date.now() + Math.floor(Math.random() * 1000), name, avatar: profileDraft.avatar, ageGroup: profileDraft.ageGroup, history: [] };
            profiles.push(p);
            setActiveProfile(p.id);
        }
        persist();
        profileDraft = null;
        render();
    });
    if (focusNameOnRender) { nameInput.focus(); focusNameOnRender = false; }
}

/* ---- Subject / difficulty ---- */
function subjectHTML() {
    const group = AGE_GROUPS[currentAgeGroup()];
    const p = activeProfile();
    const inProg = p.inProgress;
    let cards = group.subjects.map(key => {
        const s = SUBJECTS[key];
        return `<button class="card" style="--c:${s.color}" data-key="${key}">
      <div class="icon">${s.icon}</div><h3>${s.name}</h3><span class="tag">${s.tag}</span>
    </button>`;
    }).join("");
    const resumeBanner = inProg ? `
    <div class="q-card" style="text-align:left;margin-bottom:16px;padding:18px 20px;">
      <p style="margin:0 0 8px;font-weight:800;font-family:'Baloo 2'">📝 Continue your ${SUBJECTS[inProg.key].name} worksheet?</p>
      <p style="margin:0 0 14px;color:var(--muted);font-size:.9rem">You were on question ${inProg.index + 1} of ${inProg.questions.length}</p>
      <div style="display:flex;gap:10px">
        <button class="next-btn btn-full" id="resumeBtn" style="background:${SUBJECTS[inProg.key].color};margin-top:0">Resume</button>
        <button class="btn-secondary btn-full" id="discardBtn">Start fresh</button>
      </div>
    </div>` : "";
    return `
    <div class="topbar">${profileChipHTML()}</div>
    <div class="home-head"><h1>${group.label}</h1><p>${group.range} · Pick a subject</p></div>
    ${resumeBanner}
    <div class="grid">${cards}</div>
    <button class="back btn-full" id="dashBtn" style="margin-top:16px">📊 My Progress</button>
  `;
}
function attachSubject() {
    document.getElementById('dashBtn').addEventListener('click', () => { showDashboard = true; render(); });
    const chip = document.getElementById('chipBtn');
    if (chip) chip.addEventListener('click', () => { activeProfileId = null; render(); });
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => { state = activeProfile().inProgress; render(); });
    const discardBtn = document.getElementById('discardBtn');
    if (discardBtn) discardBtn.addEventListener('click', () => { clearSession(); render(); });
    document.querySelectorAll('[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            if (currentAgeGroup() === "elementary" && key === "math") {
                pendingSubjectKey = key;
                render();
                return;
            }
            if (currentAgeGroup() === "elementary" && key === "reading") {
                // Show language selection for reading
                pendingSubjectKey = key;
                renderLanguageSelection();
                return;
            }
            const s = SUBJECTS[key];
            state = {
                key,
                color: s.color,
                difficulty: null,
                questions: s.build(),
                index: 0,
                correct: 0,
                streak: 0
            };
            saveSession();
            render();
        });
    });
}
function difficultyHTML() {
    const s = SUBJECTS[pendingMathKey];
    let cards = DIFFICULTIES.map(d => `
    <button class="card" style="--c:${s.color}" data-key="${d.key}">
      <h3>${d.label}</h3><span class="tag">${d.blurb}</span>
    </button>`).join("");
    return `
    <div class="topbar"><button class="back" id="subBack">← Math</button>${profileChipHTML()}</div>
    <div class="home-head"><h1>${s.name}</h1><p>Choose a difficulty</p></div>
    <div class="grid">${cards}</div>
  `;
}
function attachDifficulty() {
    document.getElementById('subBack').addEventListener('click', () => { pendingMathKey = null; render(); });
    const chip = document.getElementById('chipBtn');
    if (chip) chip.addEventListener('click', () => { activeProfileId = null; render(); });
    document.querySelectorAll('[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.key;
            const key = pendingMathKey;
            const s = SUBJECTS[key];
            state = { key, color: s.color, difficulty, questions: s.build(difficulty), index: 0, correct: 0, streak: 0 };
            pendingSubjectKey = null;
            pendingMathKey = null;
            saveSession();
            render();
        });
    });
}
function mathMenuHTML() {
    const s = SUBJECTS.math;
    const ops = ["addition", "subtraction", "multiplication", "division"];
    let cards = ops.map(key => {
        const op = SUBJECTS[key];
        return `<button class="card" style="--c:${op.color}" data-mathkey="${key}">
      <div class="icon">${op.icon}</div><h3>${op.name}</h3><span class="tag">${op.tag}</span>
    </button>`;
    }).join("");
    return `
    <div class="topbar"><button class="back" id="mathBack">← Subjects</button>${profileChipHTML()}</div>
    <div class="home-head"><h1>${s.name}</h1><p>Choose an operation</p></div>
    <div class="grid">${cards}</div>
  `;
}
function attachMathMenu() {
    document.getElementById('mathBack').addEventListener('click', () => { pendingSubjectKey = null; render(); });
    const chip = document.getElementById('chipBtn');
    if (chip) chip.addEventListener('click', () => { activeProfileId = null; render(); });
    document.querySelectorAll('[data-mathkey]').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingMathKey = btn.dataset.mathkey;
            render();
        });
    });
}

/* ---- Question / done ---- */
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
            const shapeDef = SHAPES.find(x => x.name === o.name);
            return `<button class="opt" data-val="${o.name}">${shapeDef.svg(o.color)}</button>`;
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
    document.getElementById('backBtn').addEventListener('click', () => { state = null; render(); });
    const q = state.questions[state.index];
    const fb = document.getElementById('fb');
    const nextBtn = document.getElementById('nextBtn');
    let locked = false;
    if (q.isWriting) {
        const writingInput = document.getElementById('writingInput');
        const nextBtn = document.getElementById('nextBtn');

        writingInput.addEventListener('input', () => {
            nextBtn.disabled = !writingInput.value.trim();
        });

        nextBtn.addEventListener('click', () => {
            // Save the writing response if needed
            state.index++;
            saveSession();
            render();
        });
    } else {
        document.querySelectorAll('.opt').forEach(btn => {
            btn.addEventListener('click', () => {
                if (locked) return;
                locked = true;
                const val = btn.dataset.val;
                const isCorrect = String(val) === String(q.answer);
                document.querySelectorAll('.opt').forEach(b => {
                    b.disabled = true;
                    if (String(b.dataset.val) === String(q.answer)) b.classList.add('correct');
                    else if (b === btn) b.classList.add('wrong');
                });
                if (isCorrect) {
                    state.correct++; state.streak = (state.streak || 0) + 1;
                    fb.textContent = pick(GOOD_PHRASES); fb.className = "feedback good";
                    playCorrect();
                } else {
                    state.streak = 0;
                    fb.textContent = pick(BAD_PHRASES); fb.className = "feedback bad";
                    playWrong();
                }
                saveSession();
                nextBtn.disabled = false;
            });
        });
        nextBtn.addEventListener('click', () => {
            state.index++;
            if (state.index >= state.questions.length) {
                const s = SUBJECTS[state.key];
                recordSession(state.key, s.name, state.difficulty, state.correct, state.questions.length);
                clearSession();
                playFinish();
            } else {
                saveSession();
            }
            render();
        });
    }
}

function doneHTML() {
    const s = SUBJECTS[state.key];
    const total = state.questions.length;
    const ratio = state.correct / total;
    const starCount = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
    const stars = "⭐".repeat(starCount) + "✩".repeat(3 - starCount);
    const diffLabel = state.difficulty ?
        `<p class="diff-note">${DIFFICULTIES.find(d => d.key === state.difficulty).label} level</p>` :
        "";
    return `
    <div class="q-card done" style="border-top:8px solid ${s.color}">
      <div class="stars">${stars}</div>
      <h2>All done!</h2>
      <p>You got ${state.correct} out of ${total} right.</p>
      ${diffLabel}
      <div class="done-actions">
        <button class="btn-primary" id="again" style="background:${s.color}">Play again</button>
        <button class="btn-secondary" id="dashFromDone">📊 See my progress</button>
        <button class="btn-secondary" id="home">Choose another subject</button>
      </div>
    </div>
  `;
}

function attachDone() {
    const s = SUBJECTS[state.key];
    const ratio = state.correct / state.questions.length;
    if (ratio >= 0.8) { launchConfetti(); }
    document.getElementById('again').addEventListener('click', () => {
        const key = state.key;
        const difficulty = state.difficulty;
        state = { key, color: s.color, difficulty, questions: s.build(difficulty), index: 0, correct: 0, streak: 0 };
        saveSession();
        render();
    });
    document.getElementById('home').addEventListener('click', () => { state = null; render(); });
    document.getElementById('dashFromDone').addEventListener('click', () => { state = null; showDashboard = true; render(); });
}

/* ---- Dashboard ---- */
function dashboardHTML() {
    const p = activeProfile();
    const hist = (p.history || []);
    const totalSessions = hist.length;
    const totalCorrect = hist.reduce((s, h) => s + h.correct, 0);
    const totalQs = hist.reduce((s, h) => s + h.total, 0);
    const acc = totalQs ? Math.round((totalCorrect / totalQs) * 100) : 0;

    const bySubject = {};
    hist.forEach(h => {
        if (!bySubject[h.subject]) bySubject[h.subject] = { name: h.subjectName, correct: 0, total: 0, color: (SUBJECTS[h.subject] || {}).color || 'var(--violet)' };
        bySubject[h.subject].correct += h.correct;
        bySubject[h.subject].total += h.total;
    });
    const bars = Object.values(bySubject).map(b => {
        const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
        return `<div class="bar-row">
      <div class="bl">${b.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${b.color}"></div></div>
      <div class="bp">${pct}%</div>
    </div>`;
    }).join("") || `<p class="empty-note">No sessions yet — finish a worksheet to see stats here!</p>`;

    const recent = hist.slice(-5).reverse().map(h => {
        const d = new Date(h.date);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `<div class="history-item">
      <span>${h.subjectName}${h.difficulty ? ` · <span style="text-transform:capitalize">${h.difficulty}</span>` : ""}</span>
      <span><b>${h.correct}/${h.total}</b> <span class="hd">${dateStr}</span></span>
    </div>`;
    }).join("");

    return `
    <div class="topbar"><button class="back" id="dashBack">← Back</button>${profileChipHTML()}</div>
    <div class="home-head"><h1>${p.avatar} ${p.name}'s Progress</h1></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="num">${totalSessions}</div><div class="lab">Worksheets done</div></div>
      <div class="stat-card"><div class="num">${totalCorrect}/${totalQs}</div><div class="lab">Correct answers</div></div>
      <div class="stat-card"><div class="num">${acc}%</div><div class="lab">Accuracy</div></div>
    </div>
    <h3 style="margin:0 0 10px">By subject</h3>
    <div class="bars">${bars}</div>
    ${recent ? `<h3 style="margin:0 0 10px">Recent sessions</h3>${recent}` : ""}
  `;
}
function attachDashboard() {
    document.getElementById('dashBack').addEventListener('click', () => { showDashboard = false; render(); });
    const chip = document.getElementById('chipBtn');
    if (chip) chip.addEventListener('click', () => { activeProfileId = null; showDashboard = false; render(); });
}

function renderLanguageSelection() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="topbar"><button class="back" id="langBack">← Subjects</button>${profileChipHTML()}</div>
        <div class="home-head"><h1>Reading</h1><p>Choose a language</p></div>
        <div class="grid">
            <button class="card" style="--c:var(--sky)" data-lang="english">
                <div class="icon">🇬🇧</div><h3>English</h3><span class="tag">Stories in English</span>
            </button>
            <button class="card" style="--c:var(--leaf)" data-lang="tagalog">
                <div class="icon">🇵🇭</div><h3>Tagalog</h3><span class="tag">Mga Kuwento sa Tagalog</span>
            </button>
        </div>
    `;

    document.getElementById('langBack').addEventListener('click', () => {
        pendingSubjectKey = null;
        render();
    });

    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => {
            const language = btn.dataset.lang;
            const s = SUBJECTS[pendingSubjectKey];
            state = {
                key: pendingSubjectKey,
                color: s.color,
                difficulty: null,
                questions: s.build(language),
                index: 0,
                correct: 0,
                streak: 0
            };
            pendingSubjectKey = null;
            saveSession();
            render();
        });
    });
}

initStorage();
