import { Typography, Alert, Button, Box } from '@mui/material';
import { CheckCircle, Error, ArrowBack, History } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import TotalRecordsCard from '../components/total-records-card';
import ImportSummaryComponent from '../components/import-summary';
import { ImportSummary, ImportResults } from '../../../proxy/contact/import/types';
import { config } from '../../../utils/config';

interface ResultsProps {
  summary: ImportSummary;
  results: ImportResults;
  onBackToImport: () => void;
}

export default function Results({
  summary,
  results,
  onBackToImport
}: ResultsProps) {
  const navigate = useNavigate();
  const hasErrors = results.numberOfErrors > 0;
  const hasSuccess = results.newContacts.length > 0 || results.updatedContacts.length > 0;

  return <>
      <h2 className='text-xl font-semibold my-4'>Import Results</h2>

      {/* Status Alert */}
      {hasSuccess && !hasErrors && (
        <Alert severity="success" className="mb-6" icon={<CheckCircle />}>
          <Typography variant="h6" className="font-semibold">
            Import Completed Successfully
          </Typography>
        </Alert>
      )}

      {hasSuccess && hasErrors && (
        <Alert severity="warning" className="mb-6" icon={<Error />}>
          <Typography variant="h6" className="font-semibold">
            Import Completed with Errors
          </Typography>
        </Alert>
      )}

      {!hasSuccess && hasErrors && (
        <Alert severity="error" className="mb-6" icon={<Error />}>
          <Typography variant="h6" className="font-semibold">
            Import Failed
          </Typography>
        </Alert>
      )}

      {/* Import Cards */}
      <TotalRecordsCard results={results} mode="results" />

      {/* Import Summary */}
      <ImportSummaryComponent summary={summary} result={results} mode="results" />

      {/* Buttons */}
      <Box className="flex flex-wrap justify-between mt-6 pt-6 border-t gap-2" sx={{alignItems: 'flex-end'}}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />}
          onClick={onBackToImport}
        >
          Start Another Import
        </Button>

        <div className='flex gap-2'>
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={() => navigate('/import/error-reports')}
          >
            Saved Error Reports
          </Button>

          {hasSuccess && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => {window.open(config.LATEST_DONATIONS_URL, '_blank')}}
            >
              Latest Imported Donations Report
            </Button>
          )}
        </div>
      </Box>
    </>
  ;
}
