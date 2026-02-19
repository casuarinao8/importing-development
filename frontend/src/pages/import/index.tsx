import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { APIContact } from '../../proxy/contact/types';
import { Proxy } from '../../proxy';
import UploadCSV from './upload-csv';
import ActionButton from './action-button';
import Preview from './preview';
import Results from './results';
import { downloadCSV } from '../../utils/downloadCSV';
import { ImportContact, ImportSummary, ImportResults, ValidationError } from '../../proxy/contact/import/types';
import { Button } from '@mui/material';
import { Description, Settings } from '@mui/icons-material';
import { ContactValidator } from './components/validation-utils';
import Progress from './components/progress';
import Papa from 'papaparse';
import Wrapper from '../../components/wrapper';
import { Utils } from '../../utils';

type ImportStep = 'upload' | 'preview' | 'progress' | 'results';

export default function DataImport() {
  const navigate = useNavigate();
  const [contact, setContact] = useState<APIContact>();
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [contacts, setContacts] = useState<ImportContact[]>([]);
  const [validContacts, setValidContacts] = useState<ImportContact[]>([]);
  const [invalidContacts, setInvalidContacts] = useState<Array<{ contact: ImportContact; errors: ValidationError[] }>>([]);
  const [summary, setSummary] = useState<ImportSummary>({
    totalRecords: 0,
    validRecords: 0,
    reviewRecords: 0,
    fileName: '',
    fileSize: ''
  });
  const [results, setResults] = useState<ImportResults>({
    totalRecords: 0,
    newContacts: [],
    updatedContacts: [],
    contributions: [],
    numberOfErrors: 0,
    errors: []
  });
  const [loading, setLoading] = useState(false);
  const [continueButton, setContinueButton] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [validationPromise, setValidationPromise] = useState<Promise<void> | null>(null);

  useEffect(() => {
    Proxy.Contact.getSelf().then(setContact);
  }, []);

  const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const handleUpload = async (data: ImportContact[], fileName: string, fileSize: string) => {
    setIsValidating(true);
    setContinueButton(false);
    
    const validationPromise = (async () => {
      try {
        const validation = await ContactValidator.validateCSVData(data);
        
        setContacts(data);
        setValidContacts(validation.validContacts);
        setInvalidContacts(validation.invalidContacts);
        setSummary({
          ...validation.summary,
          fileName,
          fileSize
        });
        setContinueButton(true);
      } catch (error) {
        console.error('Validation error:', error);
        setContinueButton(false);
      } finally {
        setIsValidating(false);
      }
    })();
    
    setValidationPromise(validationPromise);
    await validationPromise;
  };

  const handleDownloadTemplate = () => {
    const url = import.meta.env.VITE_TEMPLATE_URL;
    window.open(url, '_blank');
  };

  const handleImport = async () => {
    const BATCH_SIZE = Number(import.meta.env.VITE_BATCH_SIZE) || 50;
    console.log('BATCH_SIZE:', BATCH_SIZE, 'env value:', import.meta.env.VITE_BATCH_SIZE);
    setLoading(true);
    setTotalContacts(contacts.length);
    setProcessedCount(0);
    setCurrentStep('progress');

    const batches = chunkArray(contacts, BATCH_SIZE);
    console.log('Number of batches:', batches.length, 'Total contacts:', contacts.length);
     
    const allResults = {
      newContacts: [] as any[],
      updatedContacts: [] as any[],
      contributions: [] as any[],
      numberOfErrors: 0,
      errors: [] as any[]
    }

    try {
      // const data = await Proxy.Contact.Import.processImport(contacts);
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} contacts`);
        const data = await Proxy.Contact.Import.processImport(batch, i+1, BATCH_SIZE);
        console.log(`Batch ${i + 1} result:`, data);

        if (!data) throw new Error('Failed to process import');

        allResults.newContacts = [...allResults.newContacts, ...data.newContacts];
        allResults.updatedContacts = [...allResults.updatedContacts, ...data.updatedContacts];
        allResults.contributions = [...allResults.contributions, ...data.contributions];
        allResults.numberOfErrors += data.numberOfErrors || 0;
        allResults.errors = [...allResults.errors, ...data.errors]; 
        
        // Update progress bar
        const processedSoFar = (i + 1) * BATCH_SIZE;
        setProcessedCount(Math.min(processedSoFar, contacts.length));
        
        // Small delay
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setResults({
        totalRecords: totalContacts,
        ...allResults
      });
      
      // delay for progress bar to reach 100%
      setProcessedCount(contacts.length);
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep('results');

    } catch (error) {
      console.error('Import error:', error);
      // Set error results
      setResults({
        totalRecords: totalContacts,
        newContacts: [],
        updatedContacts: [],
        contributions: [],
        numberOfErrors: contacts.length,
        errors: contacts.map((contact, index) => ({
          contact: contact,
          errors: [{
            row: index + 1,
            field: 'general',
            message: 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error')  
          }]
        }))
      });
      setCurrentStep('results');
    } finally {
      setLoading(false);
    }
  };

  const handleImportValidOnly = async () => {
    const BATCH_SIZE = Number(import.meta.env.VITE_BATCH_SIZE) || 50;
    setLoading(true);
    setTotalContacts(validContacts.length);
    setProcessedCount(0);
    setCurrentStep('progress');
    
    const batches = chunkArray(validContacts, BATCH_SIZE);
     
    const allResults = {
      newContacts: [] as any[],
      updatedContacts: [] as any[],
      contributions: [] as any[],
      numberOfErrors: 0,
      errors: [] as any[]
    }
    
    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const data = await Proxy.Contact.Import.processImport(batch);

        if (!data) throw new Error('Failed to process import');
        
        allResults.newContacts = [...allResults.newContacts, ...data.newContacts];
        allResults.updatedContacts = [...allResults.updatedContacts, ...data.updatedContacts];
        allResults.contributions = [...allResults.contributions, ...data.contributions];
        allResults.numberOfErrors += data.numberOfErrors || 0;
        allResults.errors = [...allResults.errors, ...data.errors];
        
        // Update progress bar
        const processedSoFar = (i + 1) * BATCH_SIZE;
        setProcessedCount(Math.min(processedSoFar, validContacts.length));
        
        // Small delay
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      setResults({
        totalRecords: totalContacts,
        ...allResults
      });

      // delay for progress bar to reach 100%
      setProcessedCount(validContacts.length);
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep('results');

    } catch (error) {
      console.error('Import error:', error);
      // Set error results
      setResults({
        totalRecords: totalContacts,
        newContacts: [],
        updatedContacts: [],
        contributions: [],
        numberOfErrors: contacts.length,
        errors: [
          ...contacts.map((contact, index) => ({
            contact: contact,
            errors: [{
              row: index + 1,
              field: 'general',
              message: 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error')
            }]
          })),
        ]
      });
      setCurrentStep('results');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReview = () => {
    // Create error CSV content
    const data = invalidContacts.map((item, index) => ({
      'No.': index + 1,
      'Salutation Code': item.contact.prefix_id,
      'Error Message': item.errors.map(e => e.message).join(', '),
      'Name': item.contact.name,
      'Preferred Name': item.contact.preferred_name,
      'Contact Type': item.contact.contact_type,
      'External ID': item.contact.external_identifier,
      'Email': item.contact.email_primary,
      'Phone': item.contact.phone_primary,
      'Street Address': item.contact.street_address,
      'Floor & Unit Number': item.contact.unit_floor_number,
      'Postal Code': item.contact.postal_code,
      'TDR/NTDR': item.contact.contribution.financial_type,
      'TDR/NTDR Code': item.contact.contribution.financial_type_id,
      'Total Amount': item.contact.contribution.total_amount,
      'Donation Status Code': item.contact.contribution.contribution_status_id,
      'Payment Method Code': item.contact.contribution.payment_instrument_id,
      'Donation Date': new Date(item.contact.contribution.receive_date).toLocaleDateString("en-GB"),
      'Transaction ID': item.contact.contribution.trxn_id,
      'Donation Source': item.contact.contribution.source,
      'Campaign Code': item.contact.contribution['Additional_Contribution_Details.Campaign'],
      'Platform Code': item.contact.contribution['Additional_Contribution_Details.Payment_Platform'],
      'Recurring Donation Code': item.contact.contribution['Additional_Contribution_Details.Recurring_Donation'],
      'Remarks': item.contact.contribution['Additional_Contribution_Details.Remarks'],
      'Imported Date': item.contact.contribution['Additional_Contribution_Details.Imported_Date'],
    }));
  
    const csv = Papa.unparse(data, {
      header: true
    });
    // Add UTF-8 BOM for Excel compatibility
    const csvWithBOM = '\uFEFF' + csv;
    downloadCSV(csvWithBOM, 'pre-import_review.csv');
  };

  const handleBackToImport = () => {
    setCurrentStep('upload');
    setContacts([]);
    setInvalidContacts([]);
    setContinueButton(false);
    setIsValidating(false);
    setValidationPromise(null);
    setSummary({
      totalRecords: 0,
      validRecords: 0,
      reviewRecords: 0,
      fileName: '',
      fileSize: ''
    });
    setResults({
      totalRecords: 0,
      newContacts: [],
      updatedContacts: [],
      contributions: [],
      numberOfErrors: 0,
      errors: []
    });
  };

  const handleContinue = async () => {
    // If validation is still in progress, wait for it to complete
    if (isValidating && validationPromise) {
      await validationPromise;
    }
    setCurrentStep('preview');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'upload':
        return <>
          <div className='my-4 flex justify-between'>
            <ActionButton actionName='Import Settings' iconName={<Settings />} onClick={() => navigate('/import/settings')} />
            <ActionButton actionName='Download Template' iconName={<Description />} onClick={handleDownloadTemplate} />
          </div>
            <UploadCSV onUpload={handleUpload} setContinueButton={setContinueButton} />
            {continueButton && <div className='my-4 flex justify-end'>
              <Button 
                variant='contained' 
                color='primary' 
                className='mb-4' 
                onClick={handleContinue}
                disabled={isValidating}
              >
                {isValidating ? 'Validating...' : 'Continue'}
              </Button>
            </div>}
          </>;
      
      case 'preview':        
        return <Preview
            contacts={contacts}
            validContacts={validContacts}
            invalidContacts={invalidContacts}
            summary={summary}
            onPrevious={() => {
              setCurrentStep('upload');
              setContinueButton(false);
            }}
            onImport={handleImport}
            onImportValidOnly={handleImportValidOnly}
            onDownloadReview={handleDownloadReview}
            isLoading={loading}
          />;

      case 'progress':
        return <Progress
        totalContacts={totalContacts}
        processedContacts={processedCount}
        />;
      
      case 'results':        
        return <Results
            summary={summary}
            results={results}
            onBackToImport={handleBackToImport}
          />;
      
      default:
        return null;
    }
  };

  return (
    <Wrapper loading={!contact}>
      <div className='p-4 md:px-6 max-w-[1200px] mx-auto'>
        <h1 className='text-2xl font-semibold align-left mb-6'>{import.meta.env.VITE_IMPORT_TITLE}</h1>
        {renderStep()}
      </div>
    </Wrapper>
  );
}