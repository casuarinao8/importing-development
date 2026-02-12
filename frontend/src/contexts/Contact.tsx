import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { Proxy } from '../proxy';
import { APIContact } from '../proxy/contact/types';

interface ContactContextType {
  contact: APIContact | null;
  setContact: React.Dispatch<React.SetStateAction<APIContact | null>>;
}
export const ContactContext = createContext<ContactContextType | null>(null);

export const SubtypesProvider = ({ children }: PropsWithChildren) => {
  const [contact, setContact] = useState<APIContact | null>(null);

  useEffect(() => {
    Proxy.Contact.getSelf().then(contact => setContact(contact));
  }, []);

  return <ContactContext.Provider value={{ contact, setContact }}>
    {children}
  </ContactContext.Provider>
}

export const useContactContext = (): (ContactContextType | null) => {
  const context = useContext(ContactContext);
  return context;
}