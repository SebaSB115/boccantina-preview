const form = document.getElementById('login-form');
const message = document.getElementById('login-error');
const password = document.getElementById('password');
if (new URLSearchParams(location.search).has('updated')) message.textContent = 'Contraseña actualizada. Inicia sesión de nuevo.';
document.getElementById('show-password').addEventListener('click', (event) => {
  const shown = password.type === 'password';
  password.type = shown ? 'text' : 'password';
  event.currentTarget.textContent = shown ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(shown));
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const response = await fetch('/api/v2/admin/login', { method:'POST', credentials:'same-origin',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ username:form.elements.namedItem('username').value.trim(), password:password.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
    location.assign('/admin/');
  } catch (error) {
    message.textContent = error.message;
    password.focus();
    button.disabled = false;
  }
});
