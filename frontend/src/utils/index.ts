import axios from 'axios';

export namespace Utils {
  /** Indicates whether the current project is public or not */
  export const isPublic = import.meta.env.VITE_SITENAME == import.meta.env.VITE_SITENAME_PUBLIC;

  /** Redirects the window to the login page, and a redirect to go back into if they login again */
  export function login(window: Window) {
    window.location.href = `${import.meta.env.VITE_DOMAIN}/wp-login.php?redirect_to=${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME_PRIVATE}`;
  }

  /** Logs the user out and redirects them to the public page */
  export async function logout(window: Window) {
    await axios.post(`${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/wordpress/logout.php`);
    window.location.href = `${import.meta.env.VITE_DOMAIN}/wp-login.php?redirect_to=${encodeURIComponent(window.location.href)}`;
  }

  /** Returns whether an object is empty */
  export function isEmpty(record: Record<any, any>) {
    return !Object.keys(record).length;
  }

  /** Return a new record that contains changes between two records */
  export function getChanges(old_record: Record<any, any>, new_record: Record<any, any>) {
    const body: [string, any][] = [];
    for (const key in new_record) {
      const oldValue = old_record[key];
      const newValue = new_record[key];
      if (oldValue != newValue) body.push([key, newValue]);
    }
    return Object.fromEntries(body);
  }

  /** Strip an HTML string from all its elements */
  export function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, '');
  }

  export async function hasPermission(permission: string) {
    const response = await axios.get<number>(`${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/wordpress/has_permission.php?permission=${permission}`);
    return Boolean(response.data);
  }

  export async function encode(data: string) {
    const response = await axios.post<string>(`${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/encode.php`, { data });
    return response.data;
  }

  export async function decode(encryption: string) {
    const response = await axios.post<string>(`${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/decode.php`, { data: encryption });
    return response.data;
  }

  // export function clientEnabled() {
  //   return import.meta.env.VITE_MODULES_ENABLED.split(',').includes('Client');
  // }
}