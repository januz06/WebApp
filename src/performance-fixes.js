(() => {
  const safeDocument = typeof document !== 'undefined' ? document : null;
  if (!safeDocument || typeof window === 'undefined') return;

  const fisherYatesShuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  if (typeof window.shuffle === 'function') {
    window.shuffle = fisherYatesShuffle;
  }

  const launchConfetti = () => {
    const colors = ['#FF6F59', '#1FAE9C', '#8B5CF6', '#F4A100', '#3B82C4', '#2FA84F'];
    const fragment = safeDocument.createDocumentFragment();
    const pieces = [];

    for (let i = 0; i < 16; i++) {
      const el = safeDocument.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = `${Math.random() * 100}vw`;
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = `${(1.0 + Math.random() * 1.1)}s`;
      el.style.animationDelay = `${(Math.random() * 0.2)}s`;
      fragment.appendChild(el);
      pieces.push(el);
    }

    safeDocument.body.appendChild(fragment);
    pieces.forEach((el) => {
      setTimeout(() => el.remove(), 2600);
    });
  };

  if (typeof window.launchConfetti === 'function') {
    window.launchConfetti = launchConfetti;
  }

  const shapeMap = () => {
    const shapes = Array.isArray(window.SHAPES) ? window.SHAPES : [];
    return shapes.reduce((map, shape) => {
      map[shape.name] = shape;
      return map;
    }, {});
  };

  const renderQuestionOptions = (question) => {
    if (question.isWriting) {
      return `<div class="writing-area">
        <textarea class="writing-input" id="writingInput" placeholder="Start writing here..."></textarea>
        <button class="next-btn" id="nextBtn" style="background:${window.SUBJECTS[window.state.key].color}">Next</button>
      </div>`;
    }

    if (question.isShapeQ) {
      const map = shapeMap();
      return `<div class="options">${(question.optionsHTML || []).map((o) => {
        const shapeDef = map[o.name];
        return `<button class="opt" data-val="${o.name}">${shapeDef ? shapeDef.svg(o.color) : ''}</button>`;
      }).join('')}</div>`;
    }

    return `<div class="options">${(question.options || []).map((o) =>
      `<button class="opt" style="font-size:${window.fitFont(o, 1.3, 0.78)}" data-val="${o}">${o}</button>`
    ).join('')}</div>`;
  };

  if (typeof window.questionHTML === 'function') {
    window.questionHTML = function () {
      const s = window.SUBJECTS[window.state.key];
      const q = window.state.questions[window.state.index];
      const pct = Math.round((window.state.index / window.state.questions.length) * 100);
      const stage = q.stageHTML ? `<div class="stage">${q.stageHTML}</div>` : "";
      const optionsBlock = renderQuestionOptions(q);
      const diffTag = window.state.difficulty ? `<span style="text-transform:capitalize">${window.state.difficulty}</span> · ` : "";
      const streakTag = (window.state.streak || 0) >= 3 ? ` <span title="Streak">🔥${window.state.streak}</span>` : "";

      return `
      <div class="topbar" style="--c:${s.color}">
        <button class="back" id="backBtn">← Subjects</button>
        <div class="progress"><div style="width:${pct}%;background:${s.color}"></div></div>
        <div class="counter">${diffTag}${window.state.index + 1}/${window.state.questions.length}${streakTag}</div>
      </div>
      <div class="q-card">
        <p class="prompt" style="font-size:${window.fitFont(q.prompt, 1.4, 1.0)}">${q.prompt}</p>
        ${stage}
        ${optionsBlock}
        <div class="feedback" id="fb"></div>
        <button class="next-btn" id="nextBtn" style="background:${s.color}" disabled>Next</button>
      </div>
    `;
    };
  }

  if (typeof window.attachQuestion === 'function') {
    window.attachQuestion = function () {
      const q = window.state.questions[window.state.index];
      const fb = document.getElementById('fb');
      const nextBtn = document.getElementById('nextBtn');
      let locked = false;

      document.getElementById('backBtn').addEventListener('click', () => {
        window.state = null;
        window.render();
      });

      if (q.isWriting) {
        const writingInput = document.getElementById('writingInput');
        writingInput.addEventListener('input', () => {
          nextBtn.disabled = !writingInput.value.trim();
        });

        nextBtn.addEventListener('click', () => {
          window.state.index++;
          window.saveSession();
          window.render();
        });
        return;
      }

      const options = Array.from(document.querySelectorAll('.opt'));
      options.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          locked = true;
          const value = btn.dataset.val;
          const isCorrect = String(value) === String(q.answer);

          options.forEach((b) => {
            b.disabled = true;
            if (String(b.dataset.val) === String(q.answer)) b.classList.add('correct');
            else if (b === btn) b.classList.add('wrong');
          });

          if (isCorrect) {
            window.state.correct++;
            window.state.streak = (window.state.streak || 0) + 1;
            fb.textContent = window.pick(window.GOOD_PHRASES);
            fb.className = 'feedback good';
            window.playCorrect();
          } else {
            window.state.streak = 0;
            fb.textContent = window.pick(window.BAD_PHRASES);
            fb.className = 'feedback bad';
            window.playWrong();
          }

          window.saveSession();
          nextBtn.disabled = false;
        });
      });

      nextBtn.addEventListener('click', () => {
        window.state.index++;
        if (window.state.index >= window.state.questions.length) {
          const s = window.SUBJECTS[window.state.key];
          window.recordSession(window.state.key, s.name, window.state.difficulty, window.state.correct, window.state.questions.length);
          window.clearSession();
          window.playFinish();
        } else {
          window.saveSession();
        }
        window.render();
      });
    };
  }
})();
