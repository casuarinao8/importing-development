import axios from 'axios';
import { APIContact, APIContactType, APIRelationship, UpdateContactOptions } from './types';
import ImportManager from './import';

export default class ContactManager {
	private static route = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME}/api/civicrm/contact`;

	static Import = ImportManager;

	/** Retrieve the contact of the currently logged in user */
	static async getSelf() {
		const response = await axios.get<APIContact>(`${this.route}/get_self.php`);
		return response.data;
	}

	/** Update the contact that the Wordpress user is associated with via email */
	static async updateSelf(values: UpdateContactOptions) {
		const response = await axios.post<APIContact>(`${this.route}/update_self.php`, { values });
		return response.data;
	}

	/** Return an array of relationships */
	static async fetchRelationships(type?: string) {
		const response = await axios.get<APIRelationship[]>(`${this.route}/get_relationships.php${type ? `?type=${type}` : ''}`);
		return response.data;
	}

	/** Retrieve the contact types */
	static async getContactTypes() {
		const response = await axios.get<APIContactType[]>(`${this.route}/contact-type/get_contact_types.php`);
		return response.data;
	}
}