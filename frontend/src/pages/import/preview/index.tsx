import { Typography, Alert } from '@mui/material';
import TotalRecordsCard from '../components/total-records-card';
import ImportSummaryComponent from '../components/import-summary';
import ImportButtons from '../components/import-buttons';
import { ImportContact, ImportSummary, ValidationError } from '../../../proxy/contact/import/types';

interface PreviewProps {
  contacts: ImportContact[];
  validContacts: ImportContact[];
  invalidContacts: Array<{ contact: ImportContact; errors: ValidationError[] }>;
  summary: ImportSummary;
  onPrevious: () => void;
  onImport: () => void;
  onImportValidOnly: () => void;
  onDownloadReview: () => void;
  isLoading?: boolean;
}

export default function Preview({
  contacts,
  validContacts,
  invalidContacts,
  summary,
  onPrevious,
  onImport,
  onImportValidOnly,
  onDownloadReview,
  isLoading = false
}: PreviewProps) {
  const hasErrors = invalidContacts.length > 0;
  const hasValidData = validContacts.length > 0;
  
  return <>
      <h2 className='text-xl font-semibold my-4'>Preview</h2>

      {/* Status Alert */}
      {!hasValidData && hasErrors && (
        <Alert severity="error" className="mb-6">
          <Typography variant="body2">
            Please review the errors below before importing.
          </Typography>
        </Alert>
      )}

      {hasValidData && hasErrors && (
        <Alert severity="warning" className="mb-6">
          <Typography variant="body2">
            You can import the valid records or review all errors before proceeding.
          </Typography>
        </Alert>
      )}

      {hasValidData && !hasErrors && (
        <Alert severity="success" className="mb-6">
          <Typography variant="body2">
            All records are ready to be imported.
          </Typography>
        </Alert>
      )}

      {/* Import Cards */}
      <TotalRecordsCard 
        summary={summary} 
        mode="preview" 
        tabularData={{ contacts, validContacts, invalidContacts, summary }}
      />

      {/* Import Summary */}
      <ImportSummaryComponent summary={summary} mode="preview" />

      {/* Buttons */}
      <ImportButtons
        summary={summary}
        onPrevious={onPrevious}
        onImport={onImport}
        onImportValidOnly={onImportValidOnly}
        onDownloadReview={onDownloadReview}
        isLoading={isLoading}
      />
  </>;
}
