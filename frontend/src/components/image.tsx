import { MouseEvent } from 'react';
import { CiFileOff } from 'react-icons/ci';

interface ImageProps {
  url?: string | null;
  alt?: string;
  className?: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export default function Image(props: ImageProps) {
  return <div className={`${props.className} rounded-lg bg-gray-200 relative`} onClick={props.onClick}>
    <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'>
      <CiFileOff className='text-[80px] text-gray-500' />
    </div>
    {!!props.url && <img alt={props.alt} src={props.url} className='absolute w-full h-full object-contain z-10' />}
  </div>
}