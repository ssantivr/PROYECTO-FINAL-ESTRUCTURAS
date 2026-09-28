import { h } from '../core/dom';
import { api, describeApiError, setAuthToken, type AuthUser } from '../services/apiClient';
import { brandMark } from './Sidebar';

type Mode = 'login' | 'register';

export function showAuthScreen(root: HTMLElement, options: { allowOffline: boolean }): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    let mode: Mode = 'login';
    const error = h('p', { class: 'form-error', role: 'alert' });
    const name = h('input', { type: 'text', name: 'name', autocomplete: 'name', maxlength: 120 });
    const email = h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, maxlength: 160 });
    const password = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true, minlength: 8, maxlength: 128 });
    const nameField = h('label', { class: 'field' }, h('span', {}, 'Nombre'), name);
    const submit = h('button', { class: 'btn btn-primary auth-submit', type: 'submit' });
    const title = h('h1', {});
    const toggle = h('button', { class: 'link-btn', type: 'button' });

    const render = () => {
      title.textContent = mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
      submit.textContent = mode === 'login' ? 'Entrar' : 'Registrarme';
      toggle.textContent = mode === 'login' ? '¿No tiene cuenta? Regístrese' : '¿Ya tiene cuenta? Inicie sesión';
      nameField.hidden = mode === 'login';
      password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      error.textContent = '';
    };
    toggle.addEventListener('click', () => {
      mode = mode === 'login' ? 'register' : 'login';
      render();
    });

    const form = h('form', { class: 'auth-form', novalidate: true },
      title,
      h('p', { class: 'auth-lead' }, 'Sus proyectos se guardan en PostgreSQL y solo usted puede verlos.'),
      nameField,
      h('label', { class: 'field' }, h('span', {}, 'Correo electrónico'), email),
      h('label', { class: 'field' }, h('span', {}, 'Contraseña'), password),
      error,
      submit,
      toggle,
      h('p', { class: 'auth-hint' }, 'Cuenta de demostración: demo@arquila.co · arquila2026'),
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (mode === 'register' && name.value.trim().length < 2) {
        error.textContent = 'Ingrese su nombre.';
        return;
      }
      if (!email.value.includes('@') || password.value.length < (mode === 'register' ? 8 : 1)) {
        error.textContent = mode === 'register' ? 'Ingrese un correo válido y una contraseña de al menos 8 caracteres.' : 'Ingrese su correo y contraseña.';
        return;
      }
      submit.disabled = true;
      try {
        const session = mode === 'login'
          ? await api.login(email.value.trim(), password.value)
          : await api.register(name.value.trim(), email.value.trim(), password.value);
        setAuthToken(session.token);
        overlay.remove();
        resolve(session.user);
      } catch (err) {
        error.textContent = describeApiError(err, 'No fue posible iniciar sesión.');
      } finally {
        submit.disabled = false;
      }
    });

    const offline = options.allowOffline
      ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { overlay.remove(); resolve(null); } }, 'Continuar sin conexión')
      : null;

    const overlay = h('div', { class: 'auth-screen' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand' },
          h('div', { class: 'brand-mark', 'aria-hidden': 'true' }, brandMark()),
          h('div', {}, h('strong', { class: 'brand-name' }, 'ARQUILA'), h('span', { class: 'brand-tag' }, 'Diseña · Analiza · Construye'))),
        form,
        offline,
      ));
    render();
    root.replaceChildren(overlay);
    email.focus();
  });
}
