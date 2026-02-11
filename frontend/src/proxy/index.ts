import BeneficiaryManager from './beneficiary';
import CharityManager from './charity';
import ContactManager from './contact';
import { CustomFieldsManager } from './custom-fields';

export namespace Proxy {
  export const Beneficiary = BeneficiaryManager;
  export const Charity = CharityManager
  export const Contact = ContactManager;
  export const CustomField = CustomFieldsManager;
}