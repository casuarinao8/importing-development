import { CircularProgress } from '@mui/material';

interface LoadingProps {
  className?: string;
}
export default function Loading(props: LoadingProps) {
  return <div className={`flex flex-col justify-center text-center ${props.className}`}>
    <CircularProgress className='mb-2' />
    <h1 className='text-xl text-gray-500 font-semibold'>Please Wait...</h1>
    <p className='text-gray-400 text-lg'>while we fetch information for you.</p>
  </div>
}