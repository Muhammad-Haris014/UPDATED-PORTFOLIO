// The 16 cards on the ring. Content comes from Haris's previous portfolio and resume.
// Each card is a real link; `art` draws the illustrated face (viewBox 0 0 260 230).

const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons';

const mono = (x, y, text, size = 11, fill = 'currentColor', extra = '') =>
  `<text x="${x}" y="${y}" font-family="JetBrains Mono, monospace" font-size="${size}" fill="${fill}" ${extra}>${text}</text>`;

const ART = {
  monogram: (c) => `
    <circle cx="130" cy="115" r="96" fill="none" stroke="${c.ac}" stroke-opacity=".35" stroke-dasharray="2 6"/>
    <circle cx="130" cy="115" r="66" fill="none" stroke="${c.fg}" stroke-opacity=".18"/>
    <circle class="orbit" cx="130" cy="19" r="5" fill="${c.ac}" style="transform-origin:130px 115px"/>
    <text x="130" y="138" text-anchor="middle" font-family="Instrument Serif, serif" font-size="78" fill="${c.fg}" font-style="italic">MH</text>`,

  mbti: (c) => {
    const types = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
    return types.map((t, i) => {
      const x = 14 + (i % 4) * 60, y = 8 + Math.floor(i / 4) * 44, hit = i === 5;
      return `<rect x="${x}" y="${y}" width="52" height="36" rx="8" fill="${hit ? c.ac : c.fg}" fill-opacity="${hit ? 1 : 0.07}" ${hit ? 'class="pulse"' : ''}/>
        ${mono(x + 26, y + 22, t, 11, hit ? c.bg : c.fg, `text-anchor="middle" fill-opacity="${hit ? 1 : 0.7}"`)}`;
    }).join('') + mono(14, 205, '“I love quiet ideas…”  →  INFP 0.91', 10.5, c.ac);
  },

  compressor: (c) => {
    let s = '';
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++)
      s += `<rect x="${12 + i * 9}" y="${40 + j * 9}" width="8" height="8" fill="${c.ac}" fill-opacity="${0.15 + ((i * 7 + j * 3) % 10) / 12}"/>`;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      s += `<rect x="${158 + i * 30}" y="${40 + j * 30}" width="28" height="28" rx="3" fill="${c.ac}" fill-opacity="${0.25 + ((i + j * 2) % 4) / 5}"/>`;
    return s + `<path d="M112 85h34m-8-7 8 7-8 7" stroke="${c.fg}" stroke-width="2" fill="none"/>
      ${mono(12, 170, '2.4 MB', 20, c.fg)}${mono(158, 170, '380 KB', 20, c.ac)}
      ${mono(12, 200, 'PIL · quality=85 · optimize', 10, c.fg, 'fill-opacity=".6"')}`;
  },

  whatsapp: (c) => `
    <rect x="14" y="8" width="150" height="30" rx="15" fill="${c.fg}" fill-opacity=".1"/>${mono(28, 27, 'free tonight?', 11, c.fg)}
    <rect x="96" y="46" width="150" height="30" rx="15" fill="${c.ac}"/>${mono(112, 65, 'yes!! 🎉 8pm', 11, c.bg)}
    <rect x="14" y="84" width="110" height="30" rx="15" fill="${c.fg}" fill-opacity=".1"/>${mono(28, 103, 'perfect 👍', 11, c.fg)}
    ${[38, 62, 30, 80, 54, 92, 70].map((h, i) => `<rect class="bar" style="--d:${i * 80}ms" x="${18 + i * 34}" y="${210 - h}" width="22" height="${h}" rx="4" fill="${c.ac}" fill-opacity="${0.35 + i / 12}"/>`).join('')}`,

  movie: (c) => {
    const frame = (x, y, sim) => `<rect x="${x}" y="${y}" width="66" height="96" rx="6" fill="${c.fg}" fill-opacity=".08" stroke="${c.ac}" stroke-opacity="${sim}"/>
      ${[0, 1, 2, 3, 4].map((k) => `<rect x="${x + 4}" y="${y + 6 + k * 18}" width="5" height="8" fill="${c.fg}" fill-opacity=".25"/><rect x="${x + 57}" y="${y + 6 + k * 18}" width="5" height="8" fill="${c.fg}" fill-opacity=".25"/>`).join('')}
      ${mono(x + 33, y + 116, sim.toFixed(2), 11, c.ac, 'text-anchor="middle"')}`;
    return frame(14, 14, 0.97) + frame(97, 14, 0.88) + frame(180, 14, 0.81) +
      `<path d="M47 150 Q130 200 213 150" stroke="${c.ac}" stroke-dasharray="3 5" fill="none"/>${mono(130, 210, 'cos(θ) similarity', 11, c.fg, 'text-anchor="middle" fill-opacity=".7"')}`;
  },

  student: (c) => `
    ${[60, 92, 74, 118, 104, 140].map((h, i) => `<rect class="bar" style="--d:${i * 70}ms" x="${22 + i * 38}" y="${190 - h}" width="26" height="${h}" rx="4" fill="${c.ac}" fill-opacity="${0.3 + i / 9}"/>`).join('')}
    <path d="M24 140 L236 40" stroke="${c.fg}" stroke-width="2" stroke-dasharray="6 5"/>
    <line x1="14" y1="190" x2="246" y2="190" stroke="${c.fg}" stroke-opacity=".3"/>
    ${mono(14, 22, 'ŷ = 0.82x + 11.4', 12, c.fg)}${mono(14, 214, 'R² 0.89 · predicted: A', 11, c.ac)}`,

  churn: (c) => {
    let pts = '';
    for (let i = 0; i < 26; i++) {
      const x = 18 + ((i * 37) % 224), stay = x < 120 ? i % 5 !== 0 : i % 5 === 0;
      const y = stay ? 150 + ((i * 13) % 40) : 30 + ((i * 17) % 40);
      pts += `<circle cx="${x}" cy="${y}" r="5" fill="${stay ? c.fg : c.ac}" fill-opacity="${stay ? 0.3 : 0.95}"/>`;
    }
    return pts + `<path d="M14 180 C110 180 140 40 246 40" stroke="${c.ac}" stroke-width="2.5" fill="none"/>
      <line x1="130" y1="10" x2="130" y2="196" stroke="${c.fg}" stroke-opacity=".35" stroke-dasharray="3 4"/>
      ${mono(14, 220, 'F1 0.84 · threshold 0.5', 11, c.fg, 'fill-opacity=".75"')}`;
  },

  chatbot: (c) => `
    <rect x="10" y="6" width="240" height="190" rx="14" fill="${c.fg}" fill-opacity=".06" stroke="${c.fg}" stroke-opacity=".15"/>
    ${mono(24, 34, '&gt; explain recursion', 12, c.fg)}
    ${mono(24, 64, '🤗 A function that', 12, c.ac)}${mono(24, 84, '   calls itself, with', 12, c.ac)}${mono(24, 104, '   a base case.', 12, c.ac)}
    <rect x="24" y="124" width="150" height="8" rx="4" fill="${c.fg}" fill-opacity=".15"/>
    <rect x="24" y="140" width="110" height="8" rx="4" fill="${c.fg}" fill-opacity=".15"/>
    ${mono(24, 180, '&gt;', 12, c.fg)}<rect class="caret" x="38" y="170" width="8" height="14" fill="${c.ac}"/>`,

  cnn: (c) => `
    ${[0, 1, 2, 3, 4].map((i) => {
      const h = 150 - i * 26, w = 22 - i * 2, x = 16 + i * 40, y = 20 + i * 13;
      return `<rect x="${x + 8}" y="${y - 8}" width="${w}" height="${h}" rx="3" fill="${c.ac}" fill-opacity=".25"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.ac}" fill-opacity="${0.4 + i / 8}"/>`;
    }).join('')}
    ${mono(226, 70, 'cat', 13, c.fg, 'text-anchor="end"')}<rect x="200" y="78" width="46" height="6" rx="3" fill="${c.ac}"/>
    ${mono(226, 118, 'dog', 13, c.fg, 'text-anchor="end" fill-opacity=".5"')}<rect x="200" y="126" width="4" height="6" rx="3" fill="${c.fg}" fill-opacity=".5"/>
    ${mono(16, 214, 'Conv2D → Pool → Dense · 0.97', 10.5, c.fg, 'fill-opacity=".75"')}`,

  intern: (c) => `
    ${mono(14, 40, 'HEAD →', 40, c.fg)}${mono(14, 70, 'Dec 2025 → now · Lahore', 13, c.ac)}
    ${['Leading the data mining team', 'Clean, transform, select', 'Analysis-ready datasets'].map((t, i) =>
      `<circle cx="20" cy="${118 + i * 32}" r="4" fill="${c.ac}"/>${mono(34, 122 + i * 32, t, 12, c.fg)}`).join('')}`,

  umt: (c) => `
    <text x="10" y="128" font-family="Instrument Serif, serif" font-size="150" fill="${c.ac}" font-style="italic">BS</text>
    ${mono(14, 170, 'Data Science', 16, c.fg)}${mono(14, 196, 'Since 2024 · Johar Town', 12, c.fg, 'fill-opacity=".6"')}`,

  stack: () => {
    const icons = ['python/python-original', 'tensorflow/tensorflow-original', 'pytorch/pytorch-original', 'scikitlearn/scikitlearn-original',
      'pandas/pandas-original', 'numpy/numpy-original', 'opencv/opencv-original', 'keras/keras-original', 'docker/docker-original'];
    return icons.map((p, i) => {
      const x = 22 + (i % 3) * 76, y = 10 + Math.floor(i / 3) * 70;
      return `<rect x="${x - 6}" y="${y - 6}" width="64" height="64" rx="16" fill="#fff" fill-opacity=".9"/><image href="${DEVICON}/${p}.svg" x="${x + 6}" y="${y + 6}" width="40" height="40" data-asset/>`;
    }).join('');
  },

  llm: (c) => ['LangChain', 'OpenAI', 'Hugging Face', 'Gradio', 'Streamlit', 'n8n', 'Zapier', 'VAPI'].map((t, i) => {
    const w = t.length * 8.6 + 26, row = Math.floor(i / 2), x = i % 2 ? 250 - w : 10;
    return `<rect x="${x}" y="${8 + row * 50}" width="${w}" height="38" rx="19" fill="none" stroke="${c.ac}" stroke-opacity="${i % 3 ? 0.4 : 1}"/>${mono(x + w / 2, 32 + row * 50, t, 13, c.fg, 'text-anchor="middle"')}`;
  }).join(''),

  journey: (c) => `
    <line x1="30" y1="14" x2="30" y2="210" stroke="${c.fg}" stroke-opacity=".3"/>
    ${[['2022', 'Python, stats, first Kaggle'], ['2023', 'ML fundamentals, pipelines'], ['2024', 'Deep learning, CV, MLOps'], ['2025', 'GenAI, LLMs, internship'], ['2026', 'Agentic AI, tools, voice']].map(([y, t], i, all) => {
      const last = i === all.length - 1, cy = 20 + i * 46;
      return `<circle cx="30" cy="${cy}" r="${last ? 8 : 5}" fill="${c.fg}" ${last ? 'class="pulse"' : ''}/>${mono(50, cy + 6, y, 18, c.fg, 'font-weight="600"')}${mono(50, cy + 22, t, 10.5, c.fg, 'fill-opacity=".7"')}`;
    }).join('')}`,

  services: (c) => ['Machine Learning', 'Deep Learning', 'Computer Vision', 'NLP', 'Predictive Modeling', 'AI Consulting'].map((t, i) =>
    `${mono(14, 26 + i * 36, String(i + 1).padStart(2, '0'), 11, c.ac)}<text x="44" y="${27 + i * 36}" font-family="Inter Tight, sans-serif" font-size="19" fill="${c.fg}">${t}</text><line x1="14" y1="${38 + i * 36}" x2="246" y2="${38 + i * 36}" stroke="${c.fg}" stroke-opacity=".12"/>`).join(''),

  contact: (c) => `
    <circle cx="200" cy="60" r="44" fill="${c.fg}"/><path d="M184 76 L216 44 M192 44h24v24" stroke="${c.bg}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <text x="10" y="160" font-family="Instrument Serif, serif" font-size="52" fill="${c.fg}" font-style="italic">Say hello.</text>
    ${mono(12, 200, 'codingacademey1@gmail.com', 12.5, c.fg)}`,
};

export const CARDS = [
  { art: 'monogram', tag: 'About', title: "Hi, I'm Haris", sub: 'AI/ML Developer & Data Scientist in Lahore', cta: 'About me', href: '#about', bg: '#111111', fg: '#f4f1ea', ac: '#ff5a1f' },
  { art: 'mbti', tag: 'Project · NLP', title: 'MBTI Personality Predictor', sub: 'Predicts personality type from text', cta: 'Live demo ↗', href: 'https://personality-predictor1.streamlit.app/', bg: '#24184f', fg: '#f1edff', ac: '#c6b8ff' },
  { art: 'compressor', tag: 'Project · Tool', title: 'Image Compressor', sub: 'Smaller files, same quality', cta: 'Live demo ↗', href: 'https://imagecompres.streamlit.app/', bg: '#0c332c', fg: '#e8fff7', ac: '#5cf2c4' },
  { art: 'whatsapp', tag: 'Project · Analytics', title: 'WhatsApp Chat Analysis', sub: 'Activity, top users & sentiment', cta: 'Live demo ↗', href: 'https://whatsappchatanaylsis.streamlit.app/', bg: '#0a281b', fg: '#eafff2', ac: '#25d366' },
  { art: 'movie', tag: 'Project · RecSys', title: 'Movie Recommender', sub: 'Content-based, cosine similarity', cta: 'Code ↗', href: 'https://github.com/Muhammad-Haris014/MOVIE_RECOMMENDER_MODEL', bg: '#2a0d11', fg: '#fff0f1', ac: '#ff4d5e' },
  { art: 'student', tag: 'Project · Regression', title: 'Student Report Model', sub: 'Predicts student performance', cta: 'Live demo ↗', href: 'https://studentreportmodel-m2mpv9zdlhdt7kqkpmbvv7.streamlit.app/', bg: '#0f1f3d', fg: '#eef4ff', ac: '#6aa8ff' },
  { art: 'churn', tag: 'Project · Classification', title: 'Customer Churn Prediction', sub: 'Telecom churn with scikit-learn', cta: 'Details', href: '#work', bg: '#2e1e07', fg: '#fff6e5', ac: '#ffb020' },
  { art: 'chatbot', tag: 'Project · GenAI', title: 'Coding Buddy', sub: 'Generative AI chatbot prototype', cta: 'Try it ↗', href: 'https://huggingface.co/spaces/harismalik01/coding_buddy', bg: '#181818', fg: '#f6f6f6', ac: '#ffd21e' },
  { art: 'cnn', tag: 'Project · Deep Learning', title: 'Cat vs Dog Classifier', sub: 'CNN in TensorFlow / Keras', cta: 'Details', href: '#work', bg: '#211538', fg: '#fbefff', ac: '#ff7ad9' },
  { art: 'intern', tag: 'Experience · Now', title: 'Team Lead & Software Engineer', sub: 'World Bridge Technologies', cta: 'Experience', href: '#experience', bg: '#f1efe8', fg: '#141414', ac: '#ff5a1f' },
  { art: 'umt', tag: 'Education', title: 'University of Management & Technology', sub: '', cta: 'Education', href: '#experience', bg: '#e6ebfb', fg: '#101a3d', ac: '#1d3fbb' },
  { art: 'stack', tag: 'Stack · Core', title: 'Python to production', sub: 'TensorFlow, PyTorch, scikit-learn', cta: 'Full stack', href: '#stack', bg: '#ff5a1f', fg: '#140a05', ac: '#140a05' },
  { art: 'llm', tag: 'Stack · GenAI', title: 'LLMs & automation', sub: 'Agents, RAG, voice & workflows', cta: 'Full stack', href: '#stack', bg: '#0d0d0d', fg: '#f4f4f4', ac: '#a5b4fc' },
  { art: 'journey', tag: 'Journey', title: '4 years building with AI', sub: '', cta: 'Timeline', href: '#journey', bg: '#d9f99d', fg: '#13200a', ac: '#13200a' },
  { art: 'services', tag: 'Services', title: 'What I can do for you', sub: '', cta: 'Get in touch', href: '#contact', bg: '#14141a', fg: '#f2f2f7', ac: '#a5b4fc' },
  { art: 'contact', tag: 'Contact', title: "Let's build something", sub: 'Usually replies within a day', cta: 'Email me ↗', href: 'mailto:codingacademey1@gmail.com', bg: '#ff5a1f', fg: '#140a05', ac: '#140a05' },
];

// The illustrated front of a card; also reused as the hover preview in the work list.
export function cardFront(card, i) {
  const n = String(i + 1).padStart(2, '0');
  return `
    <div class="face front">
      <div class="card-top"><span>${n}</span><span>${card.tag}</span></div>
      <svg class="card-art" viewBox="0 0 260 230" aria-hidden="true">${ART[card.art](card)}</svg>
      <div class="card-bottom">
        <h3>${card.title}</h3>
        ${card.sub ? `<p>${card.sub}</p>` : ''}
        <span class="card-cta">${card.cta}</span>
      </div>
    </div>`;
}

export function cardMarkup(card, i) {
  const n = String(i + 1).padStart(2, '0');
  const external = /^https?:/.test(card.href);
  const label = [card.title, card.sub, card.cta.replace(' ↗', '')].filter(Boolean).join(' — ');
  return `
  <a class="card" href="${card.href}" ${external ? 'target="_blank" rel="noopener"' : ''} aria-label="${label.replace(/"/g, '&quot;')}"
     style="--bg:${card.bg};--fg:${card.fg};--ac:${card.ac}" draggable="false">
    ${cardFront(card, i)}
    <div class="face back" aria-hidden="true">
      <span class="back-n">${n}</span>
      <span class="back-title">${card.title}</span>
      <span class="back-mark">MH</span>
    </div>
  </a>`;
}
