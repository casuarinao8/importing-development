import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Wrapper from '../components/wrapper';

export default function Root() {
	const navigate = useNavigate();

	useEffect(() => {
		navigate('/import');
	}, []);

	return <Wrapper />
}