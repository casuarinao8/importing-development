import ContactManager from './contact';
import { CustomFieldsManager } from './custom-fields';

export namespace Proxy {
  export const Contact = ContactManager;
  export const CustomField = CustomFieldsManager;
}
