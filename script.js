const publicationList = document.querySelector('#publication-list');
const codeDialog = document.querySelector('#code-dialog');
const bibtexDialog = document.querySelector('#bibtex-dialog');
const bibtexContent = document.querySelector('#bibtex-content');
const copyButton = document.querySelector('#bibtex-copy');
let copyTimer;

// Native dialogs handle Escape and restore focus to their opening button.
for (const dialog of [codeDialog, bibtexDialog]) {
  dialog.querySelector('.bibtex-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function formatAuthors(authors) {
  return authors.split(/\s+and\s+/i).map((author) => {
    const [family, given, ...rest] = author.split(',').map((part) => part.trim());
    return given ? `${rest.length ? rest.join(' ') : given} ${family}${rest.length ? `, ${given}` : ''}` : family;
  }).filter(Boolean).join(', ');
}

function legacyCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;opacity:0';
  // The active modal must contain the selection; the rest of the page is inert.
  bibtexDialog.append(textarea);
  try {
    textarea.select();
    return document.execCommand('copy');
  } finally {
    textarea.remove();
    copyButton.focus();
  }
}

copyButton.addEventListener('click', async () => {
  clearTimeout(copyTimer);
  copyButton.disabled = true;
  let copied = false;
  try {
    await navigator.clipboard.writeText(bibtexContent.textContent);
    copied = true;
  } catch {
    try { copied = legacyCopy(bibtexContent.textContent); } catch { /* Show failure below. */ }
  }
  copyButton.disabled = false;
  copyButton.textContent = copied ? 'Copied' : 'Copy failed';
  copyTimer = setTimeout(() => { copyButton.textContent = 'Copy'; }, 1500);
});

function dialogButton(label, dialog, prepare = () => {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'publication-action';
  button.textContent = label;
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => {
    prepare();
    dialog.showModal();
  });
  return button;
}

function renderPublication(publication) {
  const item = document.createElement('li');
  const title = document.createElement('strong');
  title.textContent = publication.title;
  item.append(title, document.createElement('br'));

  for (const [className, text] of [
    ['publication-authors', formatAuthors(publication.authors)],
    ['publication-venue', [publication.venue, publication.year].filter(Boolean).join(', ')]
  ]) {
    const line = document.createElement('span');
    line.className = className;
    line.textContent = text;
    item.append(line);
  }

  const links = document.createElement('span');
  links.className = 'publication-links';
  const actions = [];
  if (publication.paperUrl) {
    const paper = document.createElement('a');
    paper.href = publication.paperUrl;
    paper.target = '_blank';
    paper.rel = 'noopener noreferrer';
    paper.textContent = 'paper';
    actions.push(paper);
  }
  actions.push(dialogButton('code', codeDialog));
  if (publication.bibtex) {
    actions.push(dialogButton('BibTeX', bibtexDialog, () => {
      clearTimeout(copyTimer);
      bibtexContent.textContent = publication.bibtex;
      copyButton.textContent = 'Copy';
    }));
  }
  actions.forEach((action, index) => {
    if (index) links.append(' | ');
    links.append(action);
  });
  item.append(links);
  return item;
}

const publications = [...(window.publicationsData || [])]
  .sort((left, right) => Number(right.year) - Number(left.year));
publicationList.replaceChildren(...publications.map(renderPublication));
