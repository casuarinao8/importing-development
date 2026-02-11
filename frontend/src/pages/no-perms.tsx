import { useEffect } from 'react';
import Wrapper from '../components/wrapper';
import { useContactContext } from '../contexts/Contact';
import { Utils } from '../utils';
import { useNavigate } from 'react-router-dom';

export default function NoPerms() {
  const context = useContactContext()!;
  const navigate = useNavigate();

  useEffect(() => {
    if (context.contact) {
      const contact = context.contact!;

      let priority: string | null = null;
      if (Utils.isPatient(contact)) priority = 'patient';
      if (Utils.isCaregiver(contact)) priority = 'caregiver';
      if (Utils.isDonor(contact)) priority = 'donor';
      if (Utils.isVolunteer(contact)) priority = 'volunteer';
      if (!!priority) navigate(`/${priority}/dashboard`);
    }
  }, [context]);

  return <Wrapper checkRolePerms={false}>
    <div className='flex flex-col justify-center text-center h-screen items-center px-4'>
      <h1 className='text-2xl font-semibold text-primary'>Sorry, something went wrong!</h1>
      <p className='text-gray-700'>It looks like you don't have the necessary permissions to access this portal.</p>
      <p className='text-gray-700'>Please contact an administrator if you believe this is unexpected.</p>
    </div>
  </Wrapper>
}