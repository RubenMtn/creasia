const fs = require('fs');
const path = require('path');

function readJson(file) {
  let raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  return JSON.parse(raw);
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const locales = {
  es: {
    header: { gourmet: 'GOURMET PASS' },
    menu: { gourmet: 'GOURMET PASS' },
    gourmet: { title: 'Gourmet Pass' }
  },
  en: {
    header: { gourmet: 'GOURMET PASS' },
    menu: { gourmet: 'GOURMET PASS' },
    gourmet: { title: 'Gourmet Pass' }
  },
  zh: {
    header: { gourmet: '美食通行证' },
    menu: { gourmet: '美食通行证' },
    gourmet: { title: '美食通行证' }
  }
};

for (const [locale, updates] of Object.entries(locales)) {
  const file = path.join('src', 'assets', 'i18n', `${locale}.json`);
  const data = readJson(file);

  data.header = { ...data.header, ...updates.header };
  data.menu = { ...data.menu, ...updates.menu };
  data.gourmet = { ...(data.gourmet || {}), ...updates.gourmet };

  writeJson(file, data);
}
