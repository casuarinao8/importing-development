import { Button, Checkbox, FormGroup, ListItemText, MenuItem, Popover } from '@mui/material';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { APIOptionValue } from '../../proxy/custom-fields/types';
import { titleize } from 'inflection';

interface Props {
  label: string;
  options: APIOptionValue[];
}

export default function OptionValuePicker(props: Props) {
  const [params, setParams] = useSearchParams();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const values = JSON.parse(params.get(props.label) ?? '[]') as string[];

  return <div>
    <Button variant='contained' className='w-full normal-case' onClick={e => setAnchor(e.currentTarget)}>{titleize(props.label)}</Button>
    <Popover className='mt-2 h-full w-full top-0 lg:min-w-[200px]' open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <FormGroup>
        {props.options.map(o => <MenuItem dense value={o.value} onClick={() => {
          if (values.includes(o.value)) {
            const filter = values.filter(v => v != o.value);
            if (!filter.length) params.delete(props.label);
            else params.set(props.label, JSON.stringify(values.filter(v => v != o.value)));
          }
          else params.set(props.label, JSON.stringify([...values, o.value]));
          setParams(params);
        }}>
          <Checkbox className='pointer-events-none' checked={values.includes(o.value)} />
          <ListItemText primary={o.label} />
        </MenuItem>)}
      </FormGroup>
    </Popover>
  </div>
}