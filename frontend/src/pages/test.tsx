import { useEffect, useState } from 'react'
import { Proxy } from '../proxy';

export default function Test() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Proxy.Contact.fetchRelationships('Supervised by').then(res => {
      console.log(res);
      setLoading(false);
    })
  }, []);
  return <p>{loading ? 'Waiting for data' : 'Check the console'}</p>
}