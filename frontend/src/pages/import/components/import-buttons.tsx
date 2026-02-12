import { Button, Box } from '@mui/material';
import { ImportSummary } from '../../../proxy/contact/import/types';

interface ImportButtonsProps {
  summary: ImportSummary;
  onPrevious: () => void;
  onImport: () => void;
  onImportValidOnly: () => void;
  onDownloadReview: () => void;
  isLoading?: boolean;
}

export default function ImportButtons({ 
  summary, 
  onPrevious, 
  onImport, 
  onImportValidOnly, 
  onDownloadReview, 
  isLoading = false 
}: ImportButtonsProps) {
  const { validRecords, reviewRecords } = summary;
  
  // Determine which buttons to show based on validation results
  const showImportOnly = validRecords > 0 && reviewRecords === 0;
  const showReviewOnly = validRecords === 0 && reviewRecords > 0;
  const showBothButtons = validRecords > 0 && reviewRecords > 0;

  return (
    <Box className="flex justify-between items-center mt-6 pt-6 border-t">
      <Button 
        variant="outlined" 
        onClick={onPrevious}
        disabled={isLoading}
      >
        Previous
      </Button>
      
      <Box className="flex gap-4">
        {showImportOnly && (
          <Button 
            variant="contained" 
            color="primary"
            onClick={onImport}
            disabled={isLoading}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        )}
        
        {showReviewOnly && (
          <Button 
            variant="contained" 
            color="warning"
            onClick={onDownloadReview}
            disabled={isLoading}
          >
            Download Review File
          </Button>
        )}
        
        {showBothButtons && (
          <>
            <Button 
              variant="contained" 
              color="primary"
              onClick={onImportValidOnly}
              disabled={isLoading}
            >
              {isLoading ? 'Importing...' : 'Import Valid Only'}
            </Button>
            <Button 
              variant="outlined" 
              color="warning"
              onClick={onDownloadReview}
              disabled={isLoading}
            >
              Download Review File
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
