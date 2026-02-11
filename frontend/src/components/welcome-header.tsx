import { Avatar } from '@mui/material';
import { Link } from 'react-router-dom';
import { FiEdit } from 'react-icons/fi';
import { APIContact } from '../proxy/contact/types';

interface Props {
  contact: APIContact;
}

export default function WelcomeHeader(props: Props) {
  return <div className='relative p-6 md:p-10 bg-primary-lighter shadow-md justify-between items-center rounded-lg w-full'>
    <div className='flex flex-col md:flex-row items-center w-full'>
      <div className='mb-4 md:mb-0 md:mr-2 flex-shrink-0'>
        <Avatar className='w-16 h-16 md:w-20 md:h-20 bg-primary' alt={props.contact.first_name!} />
      </div>
      <div className='md:ml-3 lg:ml-4 mb-2 md:mb-0 text-center md:text-left'>
        <h1 className='flex font-semibold text-2xl md:text-3xl gap-x-2'>
          <span className='hidden md:block'>Welcome,</span>{props.contact.first_name} {props.contact.last_name}
        </h1>
        <h2 className='text-lg text-gray-700'>{props.contact['email_primary.email']}</h2>
      </div>
      <div className='absolute top-5 right-5'>
        <Link className='text-primary hover:text-primary-dark transition-colors duration-75 cursor-pointer' to='/profile'>
          <FiEdit className='w-6 h-6 md:w-8 md:h-8' />
        </Link>
      </div>
    </div>
  </div>
}