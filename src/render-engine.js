/* ====== Screen Rendering Engine ====== */

const screenStack = [];
const questionCache = new Map();
const activePanel = { view: null };

function getCachedQuestions(subjectKey, difficulty = null, language = null) {
    const cacheKey = JSON.stringify({ subjectKey, difficulty, language });
    if (!questionCache.has(cacheKey)) {
        const subject = SUBJECTS[subjectKey];
        if (!subject || typeof subject.build !== 'function') {
            console.warn(`Subject ${subjectKey} not found or has no builder`);
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

function pushScreen(screenName) {
    screenStack.push(screenName);
}

function popScreen() {
    if (screenStack.length > 1) {
        screenStack.pop();
        return screenStack[screenStack.length - 1];
    }
    return screenStack[0];
}

function getCurrentScreen() {
    return screenStack[screenStack.length - 1] || 'home';
}

function switchScreen(screenName, shouldReplace = false) {
    if (shouldReplace) {
        screenStack[screenStack.length - 1] = screenName;
    } else {
        pushScreen(screenName);
    }
    activePanel.view = screenName;
    renderActivePanel();
}

function renderActivePanel() {
    const view = getCurrentScreen();
    const app = document.getElementById('app');
    if (!app) return;

    let html = '';
    let attachFn = null;

    switch (view) {
        case 'question':
            if (state && state.questions && state.questions.length) {
                html = questionHTML();
                attachFn = attachQuestion;
            } else {
                switchScreen('subject', true);
                return;
            }
            break;
        case 'dashboard':
            html = dashboardHTML();
            attachFn = attachDashboard;
            break;
        case 'subject':
            html = subjectHTML();
            attachFn = attachSubject;
            break;
        case 'profile-select':
            html = profileSelectHTML();
            attachFn = attachProfileSelect;
            break;
        case 'profile-add':
            html = addProfileHTML();
            attachFn = attachAddProfile;
            break;
        case 'auth':
            html = renderAuthScreen();
            attachFn = attachAuth;
            break;
        default:
            html = '<div class="loading-wrap"><h2>Loading…</h2></div>';
    }

    app.innerHTML = html;
    if (attachFn && typeof attachFn === 'function') {
        attachFn();
    }
}

function updateQuestionPanel() {
    const s = SUBJECTS[state.key];
    const q = state.questions[state.index];
    const pct = Math.round((state.index / state.questions.length) * 100);

    const counter = document.querySelector('.counter');
    if (counter) {
        const diffTag = state.difficulty ? `<span style="text-transform:capitalize">${state.difficulty}</span> · ` : "";
        const streakTag = (state.streak || 0) >= 3 ? ` <span title="Streak">🔥${state.streak}</span>` : "";
        counter.innerHTML = `${diffTag}${state.index + 1}/${state.questions.length}${streakTag}`;
    }

    const progressBar = document.querySelector('.progress > div');
    if (progressBar) {
        progressBar.style.width = `${pct}%`;
    }

    const prompt = document.querySelector('.prompt');
    if (prompt) {
        prompt.innerHTML = q.prompt;
        prompt.style.fontSize = fitFont(q.prompt, 1.4, 1.0);
    }
}

function renderNextQuestion() {
    state.index++;
    if (state.index >= state.questions.length) {
        const s = SUBJECTS[state.key];
        recordSession(state.key, s.name, state.difficulty, state.correct, state.questions.length);
        clearSession();
        playFinish();
        switchScreen('dashboard', true);
        return;
    }
    saveSession();
    switchScreen('question', true);
}

if (typeof window !== 'undefined') {
    window.getCachedQuestions = getCachedQuestions;
    window.switchScreen = switchScreen;
    window.updateQuestionPanel = updateQuestionPanel;
    window.renderNextQuestion = renderNextQuestion;
    window.renderActivePanel = renderActivePanel;
}
