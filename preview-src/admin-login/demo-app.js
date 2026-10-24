// Acceso visual de la demostración estática. No valida usuarios en un servidor.
const form = document.getElementById('login-form');
const username = document.getElementById('username');
const password = document.getElementById('password');
const error = document.getElementById('login-error');
const toggle = document.getElementById('show-password');
const accessKey = 'boccantina.github-pages.demo-access.v1';
const siteRoot = new URL('../../', location.href);
const allowed = /^\/(?:admin\/(?:pedidos|cocina|reservaciones|extras|disponibilidad)\/|qr-mesas\/|pedido\/\?(?:modo=interno(?:&tipo=(?:counter|takeaway))?|tipo=counter)|\?admin=extras)$/;
const requested = new URLSearchParams(location.search).get('next') || '';
const destination = new URL(allowed.test(requested) ? requested.replace(/^\//, '') : 'admin/pedidos/', siteRoot);
if (/\bstatic-demo=1\b/.test(requested) || new URLSearchParams(location.search).get('static-demo') === '1') {
  destination.searchParams.set('static-demo', '1');
}

if (sessionStorage.getItem(accessKey) === '1') location.replace(destination.href);

toggle.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  toggle.textContent = visible ? 'Ocultar' : 'Mostrar';
  toggle.setAttribute('aria-pressed', String(visible));
});

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  if (username.value.trim().toLowerCase() !== 'demo-boccantina' || password.value !== 'vista2026') {
    error.textContent = 'Usuario o contraseña de demostración incorrectos.';
    password.focus();
    return;
  }
  sessionStorage.setItem(accessKey, '1');
  password.value = '';
  location.replace(destination.href);
});
