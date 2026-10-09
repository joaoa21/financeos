// Aplica o tema antes de desenhar a página (evita o "piscar" claro → escuro).
try {
  var t = localStorage.getItem('fos_tema');
  var dark = t === 'escuro' || (t !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {}
