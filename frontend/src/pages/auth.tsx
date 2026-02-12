import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Utils } from '../utils';
import { APIGenericRegistration } from '../proxy/volunteer/types';
import { Proxy } from '../proxy';
import Wrapper from '../components/wrapper';
import { Button } from '@mui/material';
import moment from 'moment';
import axios from 'axios';

export default function Auth() {
  const navigate = useNavigate();
  const { encrypted } = useParams();
  const [registration, setRegistration] = useState<APIGenericRegistration>();
  const [isEvent, setIsEvent] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<boolean>(false);
  const [rejectedCheckIn, setRejectedCheckIn] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');

  useEffect(() => {
    if (!encrypted) navigate('/'); 
    else Utils.decode(encrypted).then(id => {
      Proxy.Volunteer.getRegistrationById(parseInt(id)).then((registration) => {
        setRegistration(registration);

        if (registration['activity_type_id:name'] == 'Volunteer Event Registration') {
          setIsEvent(true);
        } else if (registration['activity_type_id:name'] == 'Volunteer Training Registration') {
          setIsTraining(true);
        }

        setStartDate(registration['schedule.activity_date_time']);

        if (registration['Volunteer_Event_Registration.Checked_In'] ?? registration['Volunteer_Training_Registration.Checked_In']) {
          setAlreadyCheckedIn(true);
          setStatusMessage(`This volunteer has already been checked in (Check in time: ${moment(registration?.['Volunteer_Event_Registration.Checked_In'] ?? registration?.['Volunteer_Training_Registration.Checked_In']).format('D MMM YYYY, hh:mm A')}).`);
        }

      }).catch(e => {
        if (axios.isAxiosError(e)) {
          if (e.response?.status === 401) navigate('/');
        }
      });
    });
  }, [encrypted]);

  // Handle check-in confirmation
  const handleCheckIn = async () => {
    try {
      setLoading(true);

      if (isEvent) {
        await Proxy.Volunteer.Events.checkIn(registration?.id!);
      }
      else if (isTraining) {
        await Proxy.Volunteer.Trainings.checkIn(registration?.id!);
      };

      const updatedRegistration = await Proxy.Volunteer.getRegistrationById(registration?.id!);
      setRegistration(updatedRegistration);
      setLoading(false);

      if (updatedRegistration['Volunteer_Event_Registration.Checked_In'] ?? updatedRegistration['Volunteer_Training_Registration.Checked_In']) {
        setCheckedIn(true);
        setStatusMessage(`User successfully checked in (Check in time: ${moment(updatedRegistration?.['Volunteer_Event_Registration.Checked_In'] ?? updatedRegistration?.['Volunteer_Training_Registration.Checked_In']).format('D MMM YYYY, hh:mm A')}).`);
      }
    } catch (error) {
      setStatusMessage('There was an error checking in the user. Please try again.');
    }
  };

  // Handle check-in rejection
  const handleRejectCheckIn = () => {
    setLoading(true);
    setRejectedCheckIn(true);
    setStatusMessage('Check-in has been rejected.');
    setLoading(false);
  };

  return (
    <Wrapper loading={!registration}>
      <div className="p-4 md:px-6 max-w-[1200px] mx-auto">
        {registration ? (
          <>
            <h1 className="text-xl">Confirm Check In</h1>
            <p className="text-md text-primary-dark mt-2">
              <b>Volunteer Name:</b> {`${registration['contact.first_name']} ${registration['contact.last_name']}`}
            </p>
            <p className="text-md text-primary-dark mt-2">
              <b>{isEvent && 'Event' || isTraining && 'Training'} Name:</b> {registration['activity.subject']}
              {isEvent ? ` - ${registration['schedule.Volunteer_Event_Schedule.Role:label']}` : ''}
            </p>
            <p className="text-md text-primary-dark mt-2">
              <b>{isEvent && 'Event' || isTraining && 'Training'} Date & Time:</b> {moment(startDate).format('D MMM YYYY, hh:mm A')} - {moment(moment(startDate).add(registration['schedule.duration'], 'minutes')).format(moment(startDate).format('D MMM') === moment(startDate).format('D MMM') ? 'hh:mm A' : 'D MMM YYYY, hh:mm A')}
            </p>
            <div className="mt-4">
              <Button variant="outlined" className='text-primary' onClick={handleRejectCheckIn} disabled={loading || alreadyCheckedIn || checkedIn || rejectedCheckIn} loading={loading}>
                Reject
              </Button>
              <Button variant="outlined" className="ml-4 text-primary-dark" onClick={handleCheckIn} disabled={loading || alreadyCheckedIn || checkedIn || rejectedCheckIn} loading={loading}>
                Confirm
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl">Scan a QR Code to Check In</h1>
            <p className='text-md text-primary-dark mt-2'>Please scan a valid QR code to check in.</p>
          </>
        )}

        {statusMessage && (
          <div className="status-message mt-4">
            <p className='text-md text-primary-dark'>{statusMessage}</p>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
