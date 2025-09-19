const fs = require('fs');
const path = require('path');

function load(file) {
  let raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const updates = {
  es: {
    header: { culture: 'CULTURA' },
    menu: { culture: 'CULTURA' },
    cultura: { title: 'Cultura' }
  },
  en: {
    header: { culture: 'CULTURE' },
    menu: { culture: 'CULTURE' },
    cultura: { title: 'Culture' }
  },
  zh: {
    header: { culture: '文化' },
    menu: { culture: '文化' },
    cultura: { title: '文化' }
  }
};

for (const [locale, cfg] of Object.entries(updates)) {
  const file = path.join('src/assets/i18n', `${locale}.json`);
  const data = load(file);
  data.header = { ...data.header, ...cfg.header };
  data.menu = { ...data.menu, ...cfg.menu };
  data.cultura = { ...(data.cultura || {}), ...cfg.cultura };
  save(file, data);
}
