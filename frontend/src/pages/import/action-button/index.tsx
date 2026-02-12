import { ReactNode } from 'react';
import { Button } from '@mui/material';

interface ActionButtonProps {
  actionName: string;
  iconName?: ReactNode;
  variant?: 'contained' | 'outlined' | 'text';
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
}

export default function ActionButton({ actionName, iconName, variant='contained', disabled=false, type='button', onClick }: ActionButtonProps) {
  return (
    <Button 
      variant={variant}
      color='primary' 
      className='mb-4'
      startIcon={iconName}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {actionName}
    </Button>
  );
}