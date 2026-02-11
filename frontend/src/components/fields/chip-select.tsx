import { Checkbox, Chip, FormControl, FormControlOwnProps, InputLabel, ListItemText, MenuItem, Select, SelectChangeEvent } from '@mui/material';

interface Props extends FormControlOwnProps {
  label: string;
  value: any[];
  onUpdate?: (e: SelectChangeEvent<any[]>) => void;
  options: [string, any][];
}

export default function ChipSelect(props: Props) {
  return <FormControl {...props}>
  <InputLabel>{props.label}</InputLabel>
  <Select
    value={props.value}
    onChange={props.onUpdate}
    label={props.label}
    multiple
    MenuProps={{ classes: { paper: 'max-h-[200px]'}}}
    renderValue={selected => <div className='flex flex-wrap gap-1'>
      {selected.map(s => <Chip label={props.options.find(o => o[1] == s)![0]} />)}
    </div>}
  >
    {props.options?.map(([label, value]) => <MenuItem dense value={value}>
      <Checkbox checked={props.value.includes(value)} />
      <ListItemText primary={label} />
    </MenuItem>)}
  </Select>
</FormControl>
}