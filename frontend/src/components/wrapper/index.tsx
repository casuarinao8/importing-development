import { PropsWithChildren, useEffect } from 'react';
import { Proxy } from '../../proxy';
import { Utils } from '../../utils';
import Loading from '../loading';
import { useContactContext } from '../../contexts/Contact';
import { useNavigate } from 'react-router-dom';
import { APIContact } from '../../proxy/contact/types';

interface Props extends PropsWithChildren {
  loading?: boolean;
  /** true by default */
  checkRolePerms?: boolean;
  canAccess?: (contact: APIContact) => boolean;
}

export default function Wrapper(props: Props) {
  const navigate = useNavigate();
  const contactContext = useContactContext();

  useEffect(() => {
    Proxy.Contact.getSelf().then(contact => {
      if (contact && Utils.isPublic) window.location.href = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME_PRIVATE}`;
      else if (!contact && !Utils.isPublic) Utils.login(window);
      else {
        if ((props.checkRolePerms == undefined || props.checkRolePerms == true) && !contact['contact_sub_type:label']?.length) {
          navigate('/noperms');
          return;
        }

        if (props.canAccess != undefined) {
          const result = props.canAccess(contact);
          if (!result) {
            navigate('/noperms');
            return;
          }
        }
        
        contactContext?.setContact(contact);
      }
    });
  }, []);

  return !contactContext?.contact ? <Loading className='h-screen items-center' /> : <>
    <div className='md:pt-0 pt-[76px]'>
      {props.loading ? <Loading className='h-screen items-center' /> : props.children}
    </div>
  </>
}