import { PropsWithChildren, useEffect } from 'react';
import { Proxy } from '../../proxy';
import { Utils } from '../../utils';
import Loading from '../loading';
import { useContactContext } from '../../contexts/Contact';

interface Props extends PropsWithChildren {
  loading?: boolean;
}

export default function Wrapper(props: Props) {
  const contactContext = useContactContext();

  useEffect(() => {
    Proxy.Contact.getSelf().then(contact => {
      if (contact && Utils.isPublic) window.location.href = `${import.meta.env.VITE_DOMAIN}/${import.meta.env.VITE_SITENAME_PRIVATE}`;
      else if (!contact && !Utils.isPublic) Utils.login(window);
      else {
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