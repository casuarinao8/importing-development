import Wrapper from '../components/wrapper';
import { useContactContext } from '../contexts/Contact';
import { Utils } from '../utils';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Root() {
	const context = useContactContext()!;
	const navigate = useNavigate();

	useEffect(() => {
		if (context.contact) {
			const contact = context.contact!;
			
			let priority = 'volunteer';
			if (Utils.isPatient(contact)) priority = 'patient';
			if (Utils.isCaregiver(contact)) priority = 'caregiver';
			if (Utils.isDonor(contact)) priority = 'donor';
			if (Utils.isVolunteer(contact)) priority = 'volunteer';
			navigate(`/${priority}/dashboard`);
		}
	}, [context]);

	return <Wrapper />
}