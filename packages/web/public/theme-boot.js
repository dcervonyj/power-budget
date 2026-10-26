/* Sets data-theme and color-scheme before first paint. External file: the production CSP is script-src 'self'. */
(function () {
  var theme = 'dark';
  try {
    var stored = localStorage.getItem('pb_theme');
    var preference = stored === 'dark' || stored === 'light' ? stored : 'system';
    if (preference === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      theme = preference;
    }
  } catch (error) {
    theme = 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
})();
