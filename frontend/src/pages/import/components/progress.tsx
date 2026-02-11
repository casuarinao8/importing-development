import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

function LinearProgressWithLabel(props: LinearProgressProps & { value: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress variant="determinate" {...props} />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
        >{`${Math.round(props.value)}%`}</Typography>
      </Box>
    </Box>
  );
}

interface ProgressProps {
  totalContacts: number;
  processedContacts: number;
}

export default function Progress ({totalContacts, processedContacts}: ProgressProps) { 
  
    const progress = totalContacts > 0 
      ? (processedContacts / totalContacts) * 100 
      : 0;
  
    return (
      <Box sx={{ width: '100%', mx: 'auto', mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Importing Data
        </Typography>
        <Box sx={{ mt: 3, mb: 2 }}>
          <LinearProgressWithLabel value={progress} />
        </Box>
        <Typography variant="body2" color="text.secondary" align="center">
          {processedContacts} of {totalContacts} records imported
        </Typography>
      </Box>
    );
  };
  