const form = document.getElementById('login-form');
const username = document.getElementById('username');
const password = document.getElementById('password');
const error = document.getElementById('login-error');
const submit = form.querySelector('[type="submit"]');
const toggle = document.getElementById('show-password');
const centralPort = Number(new URLSearchParams(location.search).get('central_port'));
if (Number.isInteger(centralPort) && centralPort > 0 && centralPort <= 65535) document.querySelector('.back-link').href = `http://127.0.0.1:${centralPort}/central/`;
const requested = new URLSearchParams(location.search).get('next') || '';
const destination = /^\/admin\/(?:pedidos|cocina|reservaciones|personal|extras|disponibilidad)\/$/.test(requested)
  || requested === '/qr-mesas/'
  || requested === '/?admin=extras'
  || /^\/pedido\/\?modo=interno(?:&tipo=(?:counter|takeaway))?$/.test(requested)
  ? requested : '/admin/pedidos/';
const views = [
  ['boccantina.orders', '/admin/pedidos/'],
  ['boccantina.kitchen', '/admin/cocina/'],
  ['boccantina.reservations', '/admin/reservaciones/'],
  ['boccantina.tables', '/qr-mesas/'],
  ['boccantina.new-order', '/pedido/?modo=interno'],
  ['boccantina.extras', '/admin/extras/'],
  ['boccantina.availability', '/admin/disponibilidad/']
];
function landing(permissions = [], role = 'staff', roles = []) {
  if (destination === '/admin/personal/' && role === 'owner') return destination;
  if (destination === '/admin/pedidos/' && roles.includes('waiter') && !roles.some(value => ['cashier','reception'].includes(value)) && permissions.includes('boccantina.tables')) return '/qr-mesas/';
  const key = destination.startsWith('/admin/pedidos/') ? 'boccantina.orders'
    : destination.startsWith('/admin/cocina/') ? 'boccantina.kitchen'
    : destination.startsWith('/admin/reservaciones/') ? 'boccantina.reservations'
    : destination.startsWith('/qr-mesas/') ? 'boccantina.tables'
    : destination.startsWith('/pedido/') ? 'boccantina.new-order'
    : destination.startsWith('/admin/disponibilidad/') ? 'boccantina.availability' : 'boccantina.extras';
  return permissions.includes(key) ? destination : views.find(([permission]) => permissions.includes(permission))?.[1] || '/admin/pedidos/';
}

fetch('/api/admin/session', { credentials:'same-origin', cache:'no-store' }).then(async (response) => {
  if (response.ok) { const session = await response.json(); location.replace(landing(session.permissions, session.role, session.roles)); }
}).catch(() => {});

toggle.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  toggle.textContent = visible ? 'Ocultar' : 'Mostrar';
  toggle.setAttribute('aria-pressed', String(visible));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  submit.disabled = true;
  submit.firstChild.textContent = 'Comprobando acceso… ';
  try {
    const response = await fetch('/api/admin/login', {
      method:'POST', credentials:'same-origin', cache:'no-store',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ username:username.value.trim(), password:password.value })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
    password.value = '';
    location.replace(landing(result.permissions, result.role, result.roles));
  } catch (cause) {
    error.textContent = cause.message;
    password.focus();
  } finally {
    submit.disabled = false;
    submit.firstChild.textContent = 'Entrar a Boccantina ';
  }
});
