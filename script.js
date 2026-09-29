const translations = {
  en: {
    role: '林武',
    affiliation: 'Shenzhen University',
    aboutTitle: 'About',
    aboutP1: 'I am a postdoctoral research fellow at Shenzhen University.',
    pubTitle: 'Selected Publications',
    scholarLead: 'See my',
    scholarLink: 'Google Scholar profile',
    scholarEnd: 'for the full list.',
    updated: 'Last updated September 2026'
  },
  zh: {
    role: '林武',
    affiliation: '深圳大学',
    aboutTitle: '个人介绍',
    aboutP1: '我目前是深圳大学的一名博士后研究员。',
    pubTitle: '代表性论文',
    scholarLead: '完整论文列表请见',
    scholarLink: 'Google Scholar 主页',
    scholarEnd: '。',
    updated: '最后更新于 2026 年 9 月'
  }
};

const toggle = document.querySelector('#lang-toggle');
const publicationList = document.querySelector('#publication-list');
const savedLanguage = window.localStorage.getItem('language');
let language = savedLanguage === 'zh' ? 'zh' : 'en';

function cleanBibValue(value) {
  return value
    .replace(/[{}]/g, '')
    .replace(/\\([a-zA-Z]+)\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function readBibField(body, start) {
  let index = start;
  while (/\s/.test(body[index] || '')) index += 1;

  if (body[index] === '{') {
    const valueStart = ++index;
    let depth = 1;
    while (index < body.length && depth > 0) {
      if (body[index] === '{') depth += 1;
      if (body[index] === '}') depth -= 1;
      index += 1;
    }
    return { value: body.slice(valueStart, index - 1), next: index };
  }

  if (body[index] === '"') {
    const valueStart = ++index;
    while (index < body.length) {
      if (body[index] === '"' && body[index - 1] !== '\\') break;
      index += 1;
    }
    return { value: body.slice(valueStart, index), next: index + 1 };
  }

  const valueStart = index;
  while (index < body.length && body[index] !== ',') index += 1;
  return { value: body.slice(valueStart, index), next: index };
}

function parseBibTeX(source) {
  const parsed = [];
  let entryStart = source.indexOf('@');

  while (entryStart !== -1) {
    const open = source.indexOf('{', entryStart);
    if (open === -1) break;
    let depth = 1;
    let index = open + 1;
    let inQuotes = false;
    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === '"' && source[index - 1] !== '\\') inQuotes = !inQuotes;
      if (!inQuotes && character === '{') depth += 1;
      if (!inQuotes && character === '}') depth -= 1;
      index += 1;
    }

    const body = source.slice(open + 1, index - 1);
    const firstComma = body.indexOf(',');
    if (firstComma !== -1) {
      const fields = {};
      let fieldIndex = firstComma + 1;
      while (fieldIndex < body.length) {
        while (/\s|,/.test(body[fieldIndex] || '')) fieldIndex += 1;
        const equals = body.indexOf('=', fieldIndex);
        if (equals === -1) break;
        const name = body.slice(fieldIndex, equals).trim().toLowerCase();
        const field = readBibField(body, equals + 1);
        fields[name] = cleanBibValue(field.value);
        fieldIndex = field.next;
      }

      const venue = fields.journal || fields.booktitle || fields.school || fields.publisher || '';
      let paperUrl = fields.url || fields.pdf || '';
      if (!paperUrl && fields.doi) paperUrl = `https://doi.org/${fields.doi}`;
      if (fields.title) {
        parsed.push({
          title: fields.title,
          authors: fields.author || '',
          venue,
          year: fields.year || '',
          volume: fields.volume || '',
          number: fields.number || '',
          pages: fields.pages || '',
          paperUrl,
          repoUrl: fields.repo || fields.repository || fields.code || '',
          tweetUrl: fields.tweet || fields.twitter || ''
        });
      }
    }

    entryStart = source.indexOf('@', index);
  }

  return parsed;
}

function formatAuthors(authors) {
  return authors
    .split(/\s+and\s+/i)
    .map((author) => {
      const parts = author.split(',').map((part) => part.trim()).filter(Boolean);
      if (parts.length > 1) return `${parts[1]} ${parts[0]}`;
      return parts[0] || '';
    })
    .filter(Boolean)
    .join(', ');
}

function renderPublications(publications) {
  publicationList.replaceChildren();
  publications.forEach((publication) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = publication.title;
    item.append(title, document.createElement('br'));

    const authors = document.createElement('span');
    authors.className = 'publication-authors';
    authors.textContent = formatAuthors(publication.authors);
    item.append(authors);

    const venue = document.createElement('span');
    venue.className = 'publication-venue';
    venue.textContent = [publication.venue, publication.year]
      .filter((value) => value !== undefined && value !== null && value !== '')
      .join(', ');
    item.append(venue);

    const publicationLinks = [
      ['paper', publication.paperUrl],
      ['repo', publication.repoUrl],
      ['tweet', publication.tweetUrl]
    ].filter(([, url]) => url);
    if (publicationLinks.length) {
      const links = document.createElement('span');
      links.className = 'publication-links';
      publicationLinks.forEach(([label, url], index) => {
        if (index > 0) links.append(document.createTextNode(' | '));
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = label;
        links.append(link);
      });
      item.append(links);
    }

    publicationList.append(item);
  });
}

async function loadPublications() {
  try {
    const response = await fetch('publications.bib', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseBibTeX(await response.text());
    renderPublications(parsed);
  } catch (error) {
    console.error('Unable to load publications.bib:', error);
    const item = document.createElement('li');
    item.textContent = language === 'zh'
      ? '暂时无法加载 publications.bib，请检查文件和服务器路径。'
      : 'Unable to load publications.bib. Please check the file and server path.';
    publicationList.append(item);
  }
}

function renderLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = language === 'zh' ? '关于 · Lin Wu' : 'About · Lin Wu';
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = translations[language][element.dataset.i18n];
    if (value) element.textContent = value;
  });
  toggle.textContent = language === 'zh' ? 'English' : '中文';
  toggle.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换为中文');
}

toggle.addEventListener('click', () => {
  language = language === 'en' ? 'zh' : 'en';
  window.localStorage.setItem('language', language);
  renderLanguage();
});

renderLanguage();
loadPublications();
