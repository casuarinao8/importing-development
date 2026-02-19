import { Typography, Alert, Button, Box } from '@mui/material';
import { CheckCircle, Error, ArrowBack } from '@mui/icons-material';
import TotalRecordsCard from '../components/total-records-card';
import ImportSummaryComponent from '../components/import-summary';
import { ImportSummary, ImportResults } from '../../../proxy/contact/import/types';

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
  const hasErrors = results.numberOfErrors > 0;
  const hasSuccess = results.newContacts.length > 0 || results.updatedContacts.length > 0;

  const handleDownloadImportedReport = () => {
    // Create error CSV content
    let i = 1;
    console.log("results.newContacts", results.newContacts);
    console.log("results.updatedContacts", results.updatedContacts);
    console.log("results.contributions", results.contributions);
    
    const csvContent = [
      'No.,Contact ID,Type,Prefix ID,Name,Preferred Name,Contact Type,External ID,Email,Phone,Street Address,Floor & Unit number,Postal Code,Contribution ID,TDR/NTDR,Total Amount,Source,Received Date,Transaction ID,Remarks,Imported Date',
      ...results.newContacts.map( (item, index) => 
        `"${i++}","${item.contact_id}","${item.label}","${item.prefix_id}","${item.name}","${item.preferred_name}","${item.contact_type}","${item.external_identifier}","${item.email_primary}","${item.phone_primary}","${item.street_address}","${item.unit_floor_number}","${item.postal_code}","${item.contribution_id}","${results.contributions[index].financial_type}","${results.contributions[index].total_amount}","${results.contributions[index].source}","${results.contributions[index].receive_date}","${results.contributions[index].trxn_id}","${results.contributions[index].remarks}","${results.contributions[index].imported_date}"`
      ),
      ...results.updatedContacts.map( (item, index) =>
        `"${i++}","${item.contact_id}","${item.label}","${item.prefix_id}","${item.name}","${item.preferred_name}","${item.contact_type}","${item.external_identifier}","${item.email_primary}","${item.phone_primary}","${item.street_address}","${item.unit_floor_number}","${item.postal_code}","${item.contribution_id}","${results.contributions[index].financial_type}","${results.contributions[index].total_amount}","${results.contributions[index].source}","${results.contributions[index].receive_date}","${results.contributions[index].trxn_id}","${results.contributions[index].remarks}","${results.contributions[index].imported_date}"`
      )
    ].join('\n');

    i = 0;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imported-contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrorReport = () => {
    // Create error CSV content
    console.log("results.errors", results.errors);
    
    const csvContent = [
      'No.,Error Message,Name,Contact Type,External ID,Email,Phone,Street Address,Floor and Unit number,Postal Code,Financial Type,Financial Type Code,Donation Status Code,Total Amount,Donation Source,Campaign Code,Donation Date,Payment Method Code,Cheque Number,Transaction ID,Platform Code,Recurring Donation Code,Remarks,Imported Date',
      ...results.errors.map((item, index) => 
        `"${index + 1}","${item.errors.message}","${item.contact.name}","${item.contact.contact_type}","${item.contact.external_identifier}","${item.contact.email_primary}","${item.contact.phone_primary}","${item.contact.street_address}","${item.contact.unit_floor_number}","${item.contact.postal_code}","${item.contact.contribution.financial_type}","${item.contact.contribution.financial_type_id}","${item.contact.contribution.contribution_status_id}","${item.contact.contribution.total_amount}","${item.contact.contribution.source}","${item.contact.contribution['Additional_Contribution_Details.Campaign']}","${item.contact.contribution.receive_date}","${item.contact.contribution.payment_instrument_id}","${item.contact.contribution.check_number}","${item.contact.contribution.trxn_id}","${item.contact.contribution['Additional_Contribution_Details.Payment_Platform']}","${item.contact.contribution['Additional_Contribution_Details.Recurring_Donation']}","${item.contact.contribution['Additional_Contribution_Details.Remarks']}","${item.contact.contribution['Additional_Contribution_Details.Imported_Date']}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'not-imported-records.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <Box className="flex justify-between mt-6 pt-6 border-t" sx={{alignItems: 'flex-end'}}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />}
          onClick={onBackToImport}
        >
          Start Another Import
        </Button>
        
        <Box className="flex flex-col gap-2">
          {hasErrors && (
            <Button 
              variant="contained" 
              color="warning"
              onClick={handleDownloadErrorReport}
            >
              Download Not Imported Records
            </Button>
          )}
          
          {hasSuccess && (
            <Box className="flex flex-col gap-2">
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleDownloadImportedReport}
              >
                Download Imported Data
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => {window.open(import.meta.env.VITE_LATEST_DONATIONS_URL, '_blank')}}
              >
                Latest Imported Donations Report
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </>
  ;
}
