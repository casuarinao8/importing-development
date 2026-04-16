import { config } from './config';

export namespace Utils {
  /** Redirects the window to the login page, and a redirect to go back into if they login again */
  export function login(window: Window) {
    window.location.href = `${config.DOMAIN}/wp-login.php?redirect_to=${config.DOMAIN}/${import.meta.env.VITE_SITENAME}`;
  }
}
