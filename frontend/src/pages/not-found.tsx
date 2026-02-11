import Wrapper from '../components/wrapper';

export default function NotFound() {
  return <Wrapper>
    <div className='flex flex-col justify-center text-center h-screen items-center px-4'>
      <h1 className='text-4xl font-semibold text-primary'>404</h1>
      <p className='text-gray-700'>Looks like the page you're looking for no longer exists.</p>
    </div>
  </Wrapper>
}