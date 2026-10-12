(() => {
  const variant = new URLSearchParams(window.location.search).get('hero')?.toLowerCase();
  if (variant !== 'a') return;

  const dateFormatter = new Intl.DateTimeFormat('es-CR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
  const longDateFormatter = new Intl.DateTimeFormat('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeFormatter = new Intl.DateTimeFormat('es-CR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Costa_Rica'
  });

  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      value: date.toISOString().slice(0, 10),
      label: dateFormatter.format(date).replace('.', '')
    };
  });
  const times = ['17:00', '18:00', '19:00', '20:00', '21:00'];

  const state = {
    step: 1,
    date: '',
    guests: '2',
    time: '',
    occasion: '',
    name: '',
    phone: '',
    email: '',
    preferences: '',
    errors: {},
    confirmed: false,
    showOperations: false,
    operationStatus: 'pending'
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
  const icon = (name) => {
    const paths = {
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      edit: '<path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4"/>',
      guests: '<path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 4.5a3.5 3.5 0 0 1 0 7M21 20v-2a4 4 0 0 0-3-3.87"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      phone: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3l-4-2-2 2c-3.5-1.5-6.5-4.5-8-8l2-2-2-4Z"/>',
      shield: '<path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
      spark: '<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  };

  const dateFromValue = (value) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };
  const formattedDate = () => {
    const date = dateFromValue(state.date);
    return date ? longDateFormatter.format(date) : 'Fecha pendiente';
  };
  const formattedTime = () => {
    if (!state.time) return 'Hora pendiente';
    const [hour, minute] = state.time.split(':').map(Number);
    const date = new Date(Date.UTC(2026, 0, 1, hour + 6, minute));
    return timeFormatter.format(date).replace('a. m.', 'a. m.').replace('p. m.', 'p. m.');
  };

  document.documentElement.lang = 'es';
  document.documentElement.dataset.boccantinaReservation = 'a';
  document.documentElement.classList.remove('plwao-overflow');
  document.body.dataset.boccantinaReservation = 'a';
  document.body.classList.remove('plwao-overflow');
  document.title = 'Reservación — Propuesta A | Boccantina';
  let metaDescription = document.querySelector('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    document.head.appendChild(metaDescription);
  }
  metaDescription.content = 'Propuesta local del nuevo flujo de reservación de Boccantina.';
  document.body.innerHTML = `
    <a class="bocc-reservation-skip" href="#bocc-reservation-form">Ir a la reservación</a>
    <div class="bocc-reservation-shell">
      <header class="bocc-reservation-header">
        <a class="bocc-reservation-brand" href="/?hero=a">
          <span aria-hidden="true">B</span>
          <span><strong>Boccantina</strong><small>Cantina de vinos</small></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="/?hero=a">Inicio</a>
          <a href="/?hero=a#bocc-menu-app">Menú</a>
          <a href="tel:22341380">${icon('phone')} 2234-1380</a>
        </nav>
      </header>
      <main class="bocc-reservation-main">
        <aside class="bocc-reservation-story" aria-labelledby="bocc-reservation-title">
          <div>
            <p class="bocc-reservation-eyebrow">Propuesta A · Flujo de reservación</p>
            <h1 id="bocc-reservation-title">Tu mesa, en pocos pasos.</h1>
            <p class="bocc-reservation-lead">Una experiencia clara para elegir fecha, personas y hora antes de pedir los datos de contacto.</p>
          </div>
          <div class="bocc-reservation-benefits" aria-label="Mejoras de la propuesta">
            <div>${icon('calendar')}<span><strong>Primero la disponibilidad</strong><small>Fecha, grupo y horario en un mismo paso.</small></span></div>
            <div>${icon('edit')}<span><strong>Revisión antes de enviar</strong><small>Todo se puede corregir desde el resumen.</small></span></div>
            <div>${icon('shield')}<span><strong>Datos mínimos y claros</strong><small>Solo lo necesario para gestionar la solicitud.</small></span></div>
          </div>
          <p class="bocc-reservation-demo-note"><strong>Maquetado local:</strong> los horarios, el envío y la confirmación son simulados. No se conecta con producción.</p>
        </aside>
        <section class="bocc-reservation-card" id="bocc-reservation-form" aria-labelledby="bocc-reservation-card-title">
          <div class="bocc-reservation-card__top">
            <div><p>Reservar mesa</p><h2 id="bocc-reservation-card-title">Encuentra tu horario</h2></div>
            <span>Vista previa local</span>
          </div>
          <ol class="bocc-reservation-progress" aria-label="Progreso de la reservación">
            <li data-step-indicator="1"><span>1</span><b>Disponibilidad</b></li>
            <li data-step-indicator="2"><span>2</span><b>Tus datos</b></li>
            <li data-step-indicator="3"><span>3</span><b>Revisión</b></li>
          </ol>
          <div data-region="reservation-content"></div>
        </section>
      </main>
    </div>`;

  const app = document.querySelector('.bocc-reservation-card');
  const content = app.querySelector('[data-region="reservation-content"]');

  function errorMessage(field) {
    return state.errors[field]
      ? `<p class="bocc-field-error" id="bocc-error-${field}">${escapeHtml(state.errors[field])}</p>`
      : '';
  }

  function errorAttributes(field) {
    return state.errors[field]
      ? `aria-invalid="true" aria-describedby="bocc-error-${field}"`
      : 'aria-invalid="false"';
  }

  function renderErrorSummary() {
    const entries = Object.entries(state.errors);
    if (!entries.length) return '';
    return `<div class="bocc-error-summary" role="alert" tabindex="-1" data-region="error-summary">
      <strong>Revisa ${entries.length === 1 ? 'este dato' : 'estos datos'}:</strong>
      <ul>${entries.map(([field, message]) => `<li><a href="#bocc-${field}">${escapeHtml(message)}</a></li>`).join('')}</ul>
    </div>`;
  }

  function renderStepOne() {
    return `${renderErrorSummary()}
      <div class="bocc-reservation-form" role="form" aria-labelledby="bocc-step-one-title">
        <div class="bocc-step-heading" tabindex="-1" data-region="step-heading"><span>Paso 1 de 3</span><h3 id="bocc-step-one-title">¿Cuándo nos visitas?</h3><p>Selecciona una fecha, el tamaño del grupo y un horario de demostración.</p></div>
        <fieldset class="bocc-choice-group" id="bocc-date" tabindex="-1" ${errorAttributes('date')}>
          <legend>Fecha <span>Obligatorio</span></legend>
          <div class="bocc-date-options">
            ${dates.map((date, index) => `<button type="button" data-action="select-date" data-value="${date.value}" aria-pressed="${state.date === date.value}"><small>${index === 0 ? 'Hoy' : date.label.split(' ')[0]}</small><strong>${date.label.split(' ').slice(1).join(' ')}</strong></button>`).join('')}
          </div>
          ${errorMessage('date')}
        </fieldset>
        <div class="bocc-form-row">
          <label class="bocc-field" for="bocc-guests"><span>Número de personas <b>Obligatorio</b></span><span class="bocc-input-shell">${icon('guests')}<select id="bocc-guests" name="guests" ${errorAttributes('guests')}>
            ${['1','2','3','4','5','6','7','8','9','10','12','14','15','20+'].map((guests) => `<option value="${guests}" ${state.guests === guests ? 'selected' : ''}>${guests} ${guests === '1' ? 'persona' : 'personas'}</option>`).join('')}
          </select></span>${errorMessage('guests')}</label>
          <label class="bocc-field" for="bocc-occasion"><span>Motivo <b>Opcional</b></span><span class="bocc-input-shell">${icon('spark')}<select id="bocc-occasion" name="occasion">
            <option value="">Seleccionar</option>
            ${['Cena', 'Celebración', 'Reunión', 'Otro'].map((occasion) => `<option value="${occasion}" ${state.occasion === occasion ? 'selected' : ''}>${occasion}</option>`).join('')}
          </select></span></label>
        </div>
        <fieldset class="bocc-choice-group" id="bocc-time" tabindex="-1" ${errorAttributes('time')}>
          <legend>Hora <span>Obligatorio</span></legend>
          <div class="bocc-time-options">
            ${times.map((time) => `<button type="button" data-action="select-time" data-value="${time}" aria-pressed="${state.time === time}">${time}</button>`).join('')}
          </div>
          <p class="bocc-field-help">Horarios ilustrativos del prototipo. La solución real consultaría disponibilidad del restaurante.</p>
          ${errorMessage('time')}
        </fieldset>
        <div class="bocc-form-actions bocc-form-actions--end"><button class="bocc-primary-action" type="button" data-action="next-availability">Continuar con mis datos ${icon('arrow')}</button></div>
      </div>`;
  }

  function renderStepTwo() {
    return `${renderErrorSummary()}
      <div class="bocc-reservation-form" role="form" aria-labelledby="bocc-step-two-title">
        <div class="bocc-step-heading" tabindex="-1" data-region="step-heading"><span>Paso 2 de 3</span><h3 id="bocc-step-two-title">¿A nombre de quién?</h3><p>Estos datos permitirían al restaurante confirmar o contactar sobre la solicitud.</p></div>
        <label class="bocc-field" for="bocc-name"><span>Nombre completo <b>Obligatorio</b></span><input id="bocc-name" name="name" type="text" autocomplete="name" value="${escapeHtml(state.name)}" ${errorAttributes('name')}>${errorMessage('name')}</label>
        <div class="bocc-form-row">
          <label class="bocc-field" for="bocc-phone"><span>Teléfono <b>Obligatorio</b></span><span class="bocc-input-shell">${icon('phone')}<input id="bocc-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="Ej. 8888 8888" value="${escapeHtml(state.phone)}" ${errorAttributes('phone')}></span>${errorMessage('phone')}</label>
          <label class="bocc-field" for="bocc-email"><span>Correo electrónico <b>Obligatorio</b></span><span class="bocc-input-shell">${icon('mail')}<input id="bocc-email" name="email" type="email" autocomplete="email" placeholder="nombre@correo.com" value="${escapeHtml(state.email)}" ${errorAttributes('email')}></span>${errorMessage('email')}</label>
        </div>
        <label class="bocc-field" for="bocc-preferences"><span>Preferencias o solicitudes <b>Opcional</b></span><textarea id="bocc-preferences" name="preferences" rows="4" placeholder="Ej. restricción alimentaria, movilidad o preferencia de mesa">${escapeHtml(state.preferences)}</textarea><small>En la solución real, el restaurante confirmaría si puede atender cada solicitud.</small></label>
        <div class="bocc-form-actions"><button class="bocc-secondary-action" type="button" data-action="back">${icon('back')} Volver</button><button class="bocc-primary-action" type="button" data-action="next-details">Revisar reservación ${icon('arrow')}</button></div>
      </div>`;
  }

  function summaryRows() {
    return `<dl class="bocc-reservation-summary">
      <div><dt>${icon('calendar')} Fecha</dt><dd>${escapeHtml(formattedDate())}</dd></div>
      <div><dt>${icon('clock')} Hora</dt><dd>${escapeHtml(formattedTime())}</dd></div>
      <div><dt>${icon('guests')} Personas</dt><dd>${escapeHtml(state.guests)}</dd></div>
      <div><dt>${icon('spark')} Motivo</dt><dd>${escapeHtml(state.occasion || 'No indicado')}</dd></div>
      <div><dt>Nombre</dt><dd>${escapeHtml(state.name)}</dd></div>
      <div><dt>Contacto</dt><dd>${escapeHtml(state.phone)}<br>${escapeHtml(state.email)}</dd></div>
      <div class="bocc-reservation-summary__wide"><dt>Preferencias</dt><dd>${escapeHtml(state.preferences || 'Sin solicitudes adicionales')}</dd></div>
    </dl>`;
  }

  function renderStepThree() {
    return `<div class="bocc-reservation-form">
      <div class="bocc-step-heading" tabindex="-1" data-region="step-heading"><span>Paso 3 de 3</span><h3>Revisa antes de enviar</h3><p>Confirma que la fecha, hora y datos de contacto sean correctos.</p></div>
      ${summaryRows()}
      <div class="bocc-review-edit"><button type="button" data-action="edit-availability">${icon('edit')} Editar disponibilidad</button><button type="button" data-action="edit-details">${icon('edit')} Editar datos</button></div>
      <div class="bocc-prototype-notice">${icon('shield')}<p><strong>Esta acción es una simulación.</strong><span>No enviará información a Boccantina ni creará una reserva real.</span></p></div>
      <div class="bocc-form-actions"><button class="bocc-secondary-action" type="button" data-action="back">${icon('back')} Volver</button><button class="bocc-primary-action" type="button" data-action="confirm">Simular reservación ${icon('check')}</button></div>
    </div>`;
  }

  function renderConfirmation() {
    const statusText = state.operationStatus === 'confirmed' ? 'Confirmada en la simulación' : 'Pendiente de confirmar';
    return `<div class="bocc-confirmation" tabindex="-1" data-region="step-heading">
      <div class="bocc-confirmation__icon">${icon('check')}</div>
      <p class="bocc-confirmation__eyebrow">Así se vería la confirmación</p>
      <h3>Solicitud recibida</h3>
      <p>La experiencia real mostraría aquí el estado y enviaría los detalles por correo o mensaje.</p>
      <div class="bocc-confirmation__reference"><span>Referencia demostrativa</span><strong>BOC-DEMO-1042</strong><b>${statusText}</b></div>
      ${summaryRows()}
      <div class="bocc-prototype-notice">${icon('shield')}<p><strong>No se envió ningún dato.</strong><span>Esta confirmación existe solo dentro del preview local.</span></p></div>
      <div class="bocc-form-actions bocc-form-actions--confirmation"><button class="bocc-secondary-action" type="button" data-action="new-reservation">Nueva simulación</button><button class="bocc-primary-action" type="button" data-action="toggle-operations">${state.showOperations ? 'Ocultar vista operativa' : 'Ver cómo llega al restaurante'} ${icon('arrow')}</button></div>
      ${state.showOperations ? renderOperations() : ''}
    </div>`;
  }

  function renderOperations() {
    const confirmed = state.operationStatus === 'confirmed';
    return `<section class="bocc-operations" aria-labelledby="bocc-operations-title">
      <div class="bocc-operations__head"><div><p>Vista operativa simulada</p><h4 id="bocc-operations-title">Panel de reservaciones</h4></div><span>Solo demostración</span></div>
      <article class="bocc-operation-card">
        <header><div><span>Nueva solicitud · BOC-DEMO-1042</span><strong>${escapeHtml(state.name)}</strong></div><b data-status="${confirmed ? 'confirmed' : 'pending'}">${confirmed ? 'Confirmada' : 'Pendiente'}</b></header>
        <dl><div><dt>Fecha y hora</dt><dd>${escapeHtml(formattedDate())} · ${escapeHtml(formattedTime())}</dd></div><div><dt>Grupo</dt><dd>${escapeHtml(state.guests)} personas</dd></div><div><dt>Contacto</dt><dd>${escapeHtml(state.phone)}</dd></div><div><dt>Notas</dt><dd>${escapeHtml(state.preferences || 'Sin solicitudes')}</dd></div></dl>
        <footer><p>En una implementación real, esta tarjeta se sincronizaría con la disponibilidad y las comunicaciones del restaurante.</p>${confirmed ? '<span class="bocc-operation-done">' + icon('check') + ' Estado actualizado</span>' : '<button type="button" data-action="accept-operation">Confirmar en la simulación</button>'}</footer>
      </article>
    </section>`;
  }

  function updateProgress() {
    app.querySelectorAll('[data-step-indicator]').forEach((item) => {
      const itemStep = Number(item.dataset.stepIndicator);
      item.classList.toggle('is-active', !state.confirmed && itemStep === state.step);
      item.classList.toggle('is-complete', state.confirmed || itemStep < state.step);
      if (!state.confirmed && itemStep === state.step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  }

  function render({ focusHeading = false, focusErrors = false } = {}) {
    if (state.confirmed) content.innerHTML = renderConfirmation();
    else if (state.step === 1) content.innerHTML = renderStepOne();
    else if (state.step === 2) content.innerHTML = renderStepTwo();
    else content.innerHTML = renderStepThree();
    updateProgress();
    if (focusErrors) content.querySelector('[data-region="error-summary"]')?.focus();
    else if (focusHeading) content.querySelector('[data-region="step-heading"]')?.focus();
  }

  function validateAvailability() {
    const errors = {};
    if (!state.date) errors.date = 'Selecciona una fecha.';
    if (!state.guests) errors.guests = 'Selecciona el número de personas.';
    if (!state.time) errors.time = 'Selecciona una hora.';
    state.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function validateDetails() {
    const errors = {};
    if (state.name.trim().length < 2) errors.name = 'Escribe el nombre completo.';
    if (state.phone.replace(/\D/g, '').length < 8) errors.phone = 'Escribe un teléfono de al menos 8 dígitos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) errors.email = 'Escribe un correo electrónico válido.';
    state.errors = errors;
    return Object.keys(errors).length === 0;
  }

  app.addEventListener('input', (event) => {
    if (!event.target.name || !(event.target.name in state)) return;
    state[event.target.name] = event.target.value;
  });
  app.addEventListener('change', (event) => {
    if (!event.target.name || !(event.target.name in state)) return;
    state[event.target.name] = event.target.value;
  });

  function advanceAvailability() {
      if (!validateAvailability()) return render({ focusErrors: true });
      state.step = 2;
      state.errors = {};
      render({ focusHeading: true });
  }

  function advanceDetails() {
      if (!validateDetails()) return render({ focusErrors: true });
      state.step = 3;
      state.errors = {};
      render({ focusHeading: true });
  }

  app.addEventListener('click', (event) => {
    const errorLink = event.target.closest('.bocc-error-summary a');
    if (errorLink) {
      const target = document.querySelector(errorLink.hash);
      if (target) {
        event.preventDefault();
        target.focus();
      }
      return;
    }
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (action === 'next-availability') return advanceAvailability();
    if (action === 'next-details') return advanceDetails();
    if (action === 'select-date') {
      state.date = trigger.dataset.value;
      delete state.errors.date;
      return render();
    }
    if (action === 'select-time') {
      state.time = trigger.dataset.value;
      delete state.errors.time;
      return render();
    }
    if (action === 'back') {
      state.step = Math.max(1, state.step - 1);
      state.errors = {};
      return render({ focusHeading: true });
    }
    if (action === 'edit-availability') {
      state.step = 1;
      return render({ focusHeading: true });
    }
    if (action === 'edit-details') {
      state.step = 2;
      return render({ focusHeading: true });
    }
    if (action === 'confirm') {
      state.confirmed = true;
      state.showOperations = false;
      return render({ focusHeading: true });
    }
    if (action === 'toggle-operations') {
      state.showOperations = !state.showOperations;
      return render();
    }
    if (action === 'accept-operation') {
      state.operationStatus = 'confirmed';
      state.showOperations = true;
      return render();
    }
    if (action === 'new-reservation') {
      Object.assign(state, {
        step: 1,
        date: '',
        guests: '2',
        time: '',
        occasion: '',
        name: '',
        phone: '',
        email: '',
        preferences: '',
        errors: {},
        confirmed: false,
        showOperations: false,
        operationStatus: 'pending'
      });
      render({ focusHeading: true });
    }
  });

  app.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.target.matches('textarea, button')) return;
    event.preventDefault();
    if (!state.confirmed && state.step === 1) advanceAvailability();
    else if (!state.confirmed && state.step === 2) advanceDetails();
  });

  render();
})();
