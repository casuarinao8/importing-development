import { Button, Popover } from '@mui/material';
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers';
import { Dayjs } from 'dayjs';
import { Dispatch, SetStateAction, useState } from 'react';

interface Props {
  startDate: Dayjs | null;
  setStartDate: Dispatch<SetStateAction<Dayjs | null>>;
  endDate: Dayjs | null;
  setEndDate: Dispatch<SetStateAction<Dayjs | null>>;
  clear: () => void;
}

export default function Datepicker(props: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  return <div>
    <Button variant='contained' className='w-full normal-case' onClick={e => setAnchor(e.currentTarget)}>Date</Button>
    <Popover className='mt-2 h-full w-full top-0' open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <div className='flex flex-col gap-4 p-4'>
        {/* Start Date */}
        <DateTimePicker
          format='DD/MM/YY hh:mm A'
          label='Start Date & Time'
          views={['year', 'month', 'day', 'hours', 'minutes']}
          value={props.startDate}
          maxDate={props.endDate!}
          viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
          disablePast
          onChange={e => e && props.setStartDate(e)}
          onAccept={e => e && props.setStartDate(e)}
          slotProps={{ textField: { size: 'small' } }}
        />
        {/* End Date */}
        <DateTimePicker
          format='DD/MM/YY hh:mm A'
          label='End Date & Time'
          views={['year', 'month', 'day', 'hours', 'minutes']}
          value={props.endDate}
          minDate={props.startDate!}
          viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
          disablePast
          onChange={e => e && props.setEndDate(e)}
          onAccept={e => e && props.setEndDate(e)}
          slotProps={{ textField: { size: 'small' } }}
        />
        {(!!props.startDate || !!props.endDate) && <Button variant='outlined' size='small' onClick={props.clear} className='text-primary normal-case font-normal font-satoshi'>Clear Filters</Button>}
      </div>
    </Popover>
  </div>
}