import { KeyboardEvent, useState } from 'react';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { useSearchParams } from 'react-router-dom';

interface SearchProps {
  placeholder?: string;
}
export function Search(props: SearchProps) {
  const [value, setValue] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const updateParams = () => {
    if (value.trim().length) searchParams.set('query', value.trim());
    else searchParams.delete('query');
    setSearchParams(searchParams);
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key == 'Enter') updateParams();
  }

  const handleClick = () => {
    if (value.length) updateParams();
  }

  return <div className='relative flex justify-between items-center space-x-2 w-full py-2 rounded-lg bg-white'>
    <input {...props} onKeyDown={handleKeyDown} value={value} onChange={e => setValue(e.target.value)} className='ml-4 flex-grow focus:outline-none' />
    <button onClick={handleClick} className='text-gray-300 hover:text-primary transition-colors duration-200 h-full px-4 w-fit'>
      <FaMagnifyingGlass />
    </button>
  </div>  
}