/* ====== Question Rendering & Answer Handling ====== */

const SHAPE_LOOKUP = Object.fromEntries(SHAPES.map(shape => [shape.name, shape]));

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
        optionsBlock = `<div class="options" data-interactive="true">` + q.optionsHTML.map(o => {
            const shapeDef = SHAPE_LOOKUP[o.name];
            return `<button class="opt" data-val="${o.name}">${shapeDef ? shapeDef.svg(o.color) : ''}</button>`;
        }).join("") + `</div>`;
    } else {
        optionsBlock = `<div class="options" data-interactive="true">` + q.options.map(o =>
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
      ${!q.isWriting ? `<button class="next-btn" id="nextBtn" style="background:${s.color}" disabled>Next</button>` : ''}
    </div>
  `;
}

function attachQuestion() {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const optionsContainer = document.querySelector('.options');
    const q = state.questions[state.index];
    const fb = document.getElementById('fb');
    let answerLocked = false;

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            state = null;
            switchScreen('subject', true);
        });
    }

    if (q.isWriting) {
        const writingInput = document.getElementById('writingInput');
        if (writingInput) {
            writingInput.addEventListener('input', () => {
                nextBtn.disabled = !writingInput.value.trim();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                renderNextQuestion();
            });
        }
        return;
    }

    if (optionsContainer) {
        optionsContainer.addEventListener('click', (event) => {
            if (answerLocked) return;

            const btn = event.target.closest('.opt');
            if (!btn) return;

            answerLocked = true;
            const value = btn.dataset.val;
            const isCorrect = String(value) === String(q.answer);

            const allOptions = Array.from(document.querySelectorAll('.opt'));
            allOptions.forEach((opt) => {
                opt.disabled = true;
                if (String(opt.dataset.val) === String(q.answer)) {
                    opt.classList.add('correct');
                } else if (opt === btn) {
                    opt.classList.add('wrong');
                }
            });

            if (isCorrect) {
                state.correct++;
                state.streak = (state.streak || 0) + 1;
                fb.textContent = pick(GOOD_PHRASES);
                fb.className = 'feedback good';
                playCorrect();
            } else {
                state.streak = 0;
                fb.textContent = pick(BAD_PHRASES);
                fb.className = 'feedback bad';
                playWrong();
            }

            saveSession();
            nextBtn.disabled = false;
        }, { capture: false });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            renderNextQuestion();
        });
    }
}

if (typeof window !== 'undefined') {
    window.questionHTML = questionHTML;
    window.attachQuestion = attachQuestion;
}
