// The plain page: it stays when the station cannot start, with the notice that the station needs WebGL 2.
export function stayPlain(reason) {
  const html = document.documentElement, loader = document.getElementById('loader'), note = document.getElementById('nogl');
  html.className = ''; loader.dataset.failed = 'true';
  document.querySelector('#page')?.prepend(note);
  note.hidden = false;
  if (reason) console.warn(reason);
}
