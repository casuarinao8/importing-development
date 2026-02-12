import Wrapper from '../components/wrapper';

export default function NoPerms() {
  return <Wrapper>
    <div className='flex flex-col justify-center text-center h-screen items-center px-4'>
      <h1 className='text-2xl font-semibold text-primary'>Sorry, something went wrong!</h1>
      <p className='text-gray-700'>It looks like you don't have the necessary permissions to access this portal.</p>
      <p className='text-gray-700'>Please contact an administrator if you believe this is unexpected.</p>
    </div>
  </Wrapper>
}