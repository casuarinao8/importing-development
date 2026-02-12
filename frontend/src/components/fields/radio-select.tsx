import { FormControl, FormControlLabel, FormControlOwnProps, FormLabel, Radio, RadioGroup } from '@mui/material';
import { ChangeEvent } from 'react';

interface Props extends FormControlOwnProps {
  label: string;
  value: any;
  onUpdate?: (e: ChangeEvent<HTMLInputElement>) => void;
  options: [string, any][];
}

export default function RadioSelect(props: Props) {
  return <FormControl {...props}>
  <FormLabel>{props.label}</FormLabel>
  <RadioGroup value={props.value} onChange={props.onUpdate}>
    {props.options.map(([label, value]) => 
      <FormControlLabel value={value} control={<Radio />} label={label} />)}
  </RadioGroup>
</FormControl>
}