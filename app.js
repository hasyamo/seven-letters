// === Constants ===
const SENDER_MAP = {
  tsukiko:  { name: '月子',   day: 'mon', img: 'images/eyes-mon.webp', chibi: 'images/chibi-mon.png', paper: '#f5f0f8', line: '#e0d0e8' },
  you:      { name: '陽',     day: 'tue', img: 'images/eyes-tue.webp', chibi: 'images/chibi-tue.png', paper: '#fdf5ee', line: '#f0dcc0' },
  shizuku:  { name: 'しずく', day: 'wed', img: 'images/eyes-wed.webp', chibi: 'images/chibi-wed.png', paper: '#f0f5fa', line: '#d0dde8' },
  rinka:    { name: '凛華',   day: 'thu', img: 'images/eyes-thu.webp', chibi: 'images/chibi-thu.png', paper: '#f8f5f0', line: '#e0d8c8' },
  runa:     { name: 'るな',   day: 'fri', img: 'images/eyes-fri.webp', chibi: 'images/chibi-fri.png', paper: '#fef5f5', line: '#f0d8d8' },
  mahiru:   { name: 'まひる', day: 'sat', img: 'images/eyes-sat.webp', chibi: 'images/chibi-sat.png', paper: '#f5f0f5', line: '#e0d0e0' },
  hiyori:   { name: '日和',   day: 'sun', img: 'images/eyes-sun.webp', chibi: 'images/chibi-sun.png', paper: '#fdf5f8', line: '#f0d8e0' },
};

const OPENED_KEY = 'seven-letters-opened';

// === State ===
let letters = [];
let currentIndex = -1;
const templateCache = {};

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  loadLetters();
  document.getElementById('backToGrid').addEventListener('click', showGrid);
  document.getElementById('prevLetter').addEventListener('click', () => navigateLetter(-1));
  document.getElementById('nextLetter').addEventListener('click', () => navigateLetter(1));
});

// === Data Loading ===
async function loadLetters() {
  // TODO: クリエイター選択UI。仮でURLパラメータから取得
  const params = new URLSearchParams(location.search);
  const creator = params.get('c') || 'hasyamo';
  const year = params.get('y') || new Date().getFullYear();

  try {
    const res = await fetch(`./data/${creator}/letters/${year}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('not found');
    const json = await res.json();
    letters = (json.letters || []).sort((a, b) => b.week.localeCompare(a.week));
    renderGrid();
  } catch (e) {
    document.getElementById('letterGrid').innerHTML =
      '<div class="loading">まだ手紙は届いていません。</div>';
  }
}

// === Grid ===
function renderGrid() {
  const grid = document.getElementById('letterGrid');
  if (letters.length === 0) {
    grid.innerHTML = '<div class="loading">まだ手紙は届いていません。</div>';
    return;
  }

  const opened = getOpened();
  grid.innerHTML = letters.map((letter, i) => {
    const sender = SENDER_MAP[letter.sender] || SENDER_MAP.shizuku;
    const isOpened = opened.includes(letter.week);
    const period = letter.period;
    const dateLabel = `${period.start.slice(5)} 〜 ${period.end.slice(5)}`;

    return `
      <div class="letter-card ${isOpened ? '' : 'unopened'}" onclick="openLetter(${i})">
        ${!isOpened ? '<span class="letter-card-badge">未開封</span>' : ''}
        <div class="letter-card-date">${dateLabel}</div>
        <div class="letter-card-sender">
          <img class="letter-card-avatar" src="${sender.img}" alt="${sender.name}">
          <span class="letter-card-name">${sender.name}からの手紙</span>
        </div>
      </div>
    `;
  }).join('');
}

// === Letter View ===
async function openLetter(index) {
  currentIndex = index;
  const letter = letters[index];
  const sender = SENDER_MAP[letter.sender] || SENDER_MAP.shizuku;

  // Check if already opened before marking
  const wasOpened = getOpened().includes(letter.week);

  // Mark as opened
  markOpened(letter.week);

  // Load template
  const tmpl = await loadTemplate(letter.sender);

  // Set paper color and background
  const paper = document.querySelector('.letter-paper');
  paper.style.backgroundColor = sender.paper;
  paper.style.setProperty('--line-color', sender.line);
  const bg = document.getElementById('letterBg');
  bg.style.backgroundImage = `url(${sender.img})`;

  // Generate letter content
  const content = document.getElementById('letterContent');
  // 手紙の日付 = 集計期間の翌日（月曜）
  const endDate = new Date(letter.period.end);
  endDate.setDate(endDate.getDate() + 1);
  const writtenDate = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;

  const body = tmpl
    ? generateLetterBody(letter, sender, tmpl)
    : '<span class="letter-line">テンプレートを読み込めませんでした。</span>';

  const isFirstOpen = !wasOpened;
  const animateClass = isFirstOpen ? ' animate' : '';

  content.innerHTML = `
    <div class="letter-greeting">あなたへ</div>
    <div class="letter-body${animateClass}">${body}</div>
    <div class="letter-signature${animateClass}">
      <img class="letter-signature-avatar" src="${sender.chibi}" alt="${sender.name}"${isFirstOpen ? ' style="opacity:0"' : ''}>
      <span class="letter-signature-name">${sender.name}</span>
    </div>
    <div class="letter-date${animateClass}">${writtenDate}</div>
  `;

  // Show letter view
  document.getElementById('gridView').style.display = 'none';
  const letterView = document.getElementById('letterView');
  letterView.style.display = 'block';
  letterView.querySelector('.letter-paper').classList.remove('page-turn-enter');
  void letterView.querySelector('.letter-paper').offsetWidth;
  letterView.querySelector('.letter-paper').classList.add('page-turn-enter');

  // Nav buttons
  document.getElementById('prevLetter').disabled = index >= letters.length - 1;
  document.getElementById('nextLetter').disabled = index <= 0;

  // Sequential reveal animation (first open only)
  if (isFirstOpen) {
    const bodyEl = content.querySelector('.letter-body');
    const lines = bodyEl.querySelectorAll('.letter-line, .letter-line-empty');
    const sig = content.querySelector('.letter-signature');
    const date = content.querySelector('.letter-date');
    const avatar = content.querySelector('.letter-signature-avatar');
    let animDone = false;

    let lineIndex = 0;

    function revealAll() {
      animDone = true;
      lines.forEach(l => l.classList.add('visible'));
      sig.classList.add('visible');
      date.classList.add('visible');
      if (avatar) avatar.style.opacity = '';
    }

    // Skip on tap/click
    paper.addEventListener('click', function skipHandler() {
      if (!animDone) revealAll();
      paper.removeEventListener('click', skipHandler);
    });

    const interval = setInterval(() => {
      if (animDone) { clearInterval(interval); return; }
      if (lineIndex < lines.length) {
        lines[lineIndex].classList.add('visible');
        lineIndex++;
      } else {
        clearInterval(interval);
        sig.classList.add('visible');
        date.classList.add('visible');
        if (avatar) avatar.style.opacity = '';
        animDone = true;
      }
    }, 450);
  }

  // Re-render grid for opened state
  renderGrid();
}

function showGrid() {
  document.getElementById('letterView').style.display = 'none';
  document.getElementById('gridView').style.display = 'block';
}

function navigateLetter(dir) {
  const newIndex = currentIndex - dir; // sorted newest first
  if (newIndex >= 0 && newIndex < letters.length) {
    openLetter(newIndex);
  }
}

// === Template Loading ===
async function loadTemplate(senderKey) {
  if (templateCache[senderKey]) return templateCache[senderKey];
  try {
    const res = await fetch(`./data/templates/${senderKey}.json?t=${Date.now()}`);
    if (!res.ok) return null;
    const tmpl = await res.json();
    templateCache[senderKey] = tmpl;
    return tmpl;
  } catch {
    return null;
  }
}

// === Seeded selection (deterministic per week) ===
function weekSeed(weekStr) {
  let h = 0;
  for (let i = 0; i < weekStr.length; i++) {
    h = ((h << 5) - h + weekStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick(arr, seed, offset) {
  return arr[((seed + offset) * 2654435761 >>> 0) % arr.length];
}

// === Letter Body Generation ===
function generateLetterBody(letter, sender, tmpl) {
  const s = letter.stats;
  const likesDiff = s.likes_total - s.likes_prev;
  const followerDiff = s.followers_end - s.followers_start;
  const seed = weekSeed(letter.week);

  const n = v => `<span class="letter-number">${v}</span>`;

  const vars = {
    posts_count: n(s.posts_count),
    likes_total: n(s.likes_total),
    likes_diff: n(Math.abs(likesDiff)),
    followers_end: n(s.followers_end),
    follower_diff: n(Math.abs(followerDiff)),
    new_fans: n(s.new_fans),
    comments_total: n(s.comments_total),
    title: s.top_article ? s.top_article.title : '',
    likes: s.top_article ? n(s.top_article.likes) : '',
    comments: s.top_article ? n(s.top_article.comments) : '',
    name: s.notable_reader ? s.notable_reader.name : '',
  };

  function fillVars(str) {
    return str.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] || '');
  }

  // Pick a pattern matching the condition, fallback to "default"
  const condition = letter.condition || 'default';
  const condPatterns = tmpl.patterns.filter(p => p.condition === condition);
  const matching = condPatterns.length > 0 ? condPatterns : tmpl.patterns.filter(p => p.condition === 'default');
  const pattern = pick(matching, seed, 0);
  const lines = pattern.body;

  return lines.map(line =>
    line === '' ? '<span class="letter-line-empty"></span>' : `<span class="letter-line">${fillVars(line)}</span>`
  ).join('');
}

// === LocalStorage ===
function getOpened() {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) || '[]');
  } catch {
    return [];
  }
}

function markOpened(week) {
  const opened = getOpened();
  if (!opened.includes(week)) {
    opened.push(week);
    localStorage.setItem(OPENED_KEY, JSON.stringify(opened));
  }
}
