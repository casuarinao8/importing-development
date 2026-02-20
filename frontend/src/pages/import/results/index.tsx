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
    let i = 1;
    const contributionMap: Record<number, any> = {};
    results.contributions.forEach((c: any) => { contributionMap[c.contact_id] = c; });

    const contactRow = (item: any) => {
      const c = contributionMap[item.contact_id] ?? {};
      return `"${i++}","${item.contact_id}","${item.label}","${item.prefix_id}","${item.name}","${item.preferred_name}","${item.contact_type}","${item.external_identifier}","${item.email_primary}","${item.phone_primary}","${item.street_address}","${item.unit_floor_number}","${item.postal_code}","${item.contribution_id ?? ''}","${c.financial_type ?? ''}","${c.total_amount ?? ''}","${c.source ?? ''}","${c.receive_date ?? ''}","${c.trxn_id ?? ''}","${c.remarks ?? ''}","${c.imported_date ?? ''}"`;
    };

    const csvContent = [
      'No.,Contact ID,Type,Prefix ID,Name,Preferred Name,Contact Type,External ID,Email,Phone,Street Address,Floor & Unit number,Postal Code,Contribution ID,TDR/NTDR,Total Amount,Source,Received Date,Transaction ID,Remarks,Imported Date',
      ...results.newContacts.map(contactRow),
      ...results.updatedContacts.map(contactRow),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imported-contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrorReport = () => {
    const csvContent = [
      'No.,Error Message,Name,Contact Type,External ID,Email,Phone,Street Address,Floor and Unit number,Postal Code,Financial Type,Financial Type Code,Donation Status Code,Total Amount,Donation Source,Campaign Code,Donation Date,Payment Method Code,Cheque Number,Transaction ID,Platform Code,Recurring Donation Code,Remarks,Imported Date',
      ...results.errors.map((item, index) => {
        const contact = item.contact ?? {};
        const contrib = contact.contribution ?? {};
        return `"${index + 1}","${item.message ?? ''}","${contact.name ?? ''}","${contact.contact_type ?? ''}","${contact.external_identifier ?? ''}","${contact.email_primary ?? ''}","${contact.phone_primary ?? ''}","${contact.street_address ?? ''}","${contact.unit_floor_number ?? ''}","${contact.postal_code ?? ''}","${contrib.financial_type ?? ''}","${contrib.financial_type_id ?? ''}","${contrib.contribution_status_id ?? ''}","${contrib.total_amount ?? ''}","${contrib.source ?? ''}","${contrib['Additional_Contribution_Details.Campaign'] ?? ''}","${contrib.receive_date ?? ''}","${contrib.payment_instrument_id ?? ''}","${contrib.check_number ?? ''}","${contrib.trxn_id ?? ''}","${contrib['Additional_Contribution_Details.Payment_Platform'] ?? ''}","${contrib['Additional_Contribution_Details.Recurring_Donation'] ?? ''}","${contrib['Additional_Contribution_Details.Remarks'] ?? ''}","${contrib['Additional_Contribution_Details.Imported_Date'] ?? ''}"`;
      })
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
