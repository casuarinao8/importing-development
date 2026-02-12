import { useState } from 'react';
import { Paper, Typography, Divider, Box } from '@mui/material';
import { ImportSummary, ImportResults, ImportContact, ValidationError, Contribution } from '../../../proxy/contact/import/types';
import PopUpModal from './popup-modal';

interface TotalRecordsCardProps {
  summary?: ImportSummary;
  results?: ImportResults;
  mode: 'preview' | 'results';
  tabularData?: tabularData;
}

export interface tabularData {
  contacts: ImportContact[];
  validContacts: ImportContact[];
  invalidContacts: Array<{ contact: ImportContact; errors: ValidationError[] }>;
  summary?: ImportSummary;
  result?: ImportResults;
}

export interface modalData {
  type: 'valid' | 'invalid' | 'total' | 'contacts' | 'contributions' | 'error';
  title: string;
  data: ImportContact[] | Array<{ contact: ImportContact; errors: ValidationError[] }> | Array<{ contact: ImportContact; errors: ValidationError }> | Array<{ contact: ImportContact; row: number; field: string; message: string }> | Contribution[];
} 

function MetricCard({ value, label, colorClass, onClick }: { value: number; label: string; colorClass: string; onClick: () => void; }) {
  return (
    <Paper className="p-4 text-center rounded-lg" onClick={onClick} style={{ cursor: 'pointer', alignContent: 'center'}}>
      <Typography variant="h4" className={`${colorClass} font-bold`}>
        {value}
      </Typography>
      <Typography variant="body2" className="text-gray-600">
        {label}
      </Typography>
    </Paper>
  );
}

function ContactCard({ newContacts, updatedContacts, onClick }: { newContacts: number; updatedContacts: number; onClick: () => void; }) {
  return (
    <Paper className="p-4 text-center rounded-lg" onClick={onClick} style={{ cursor: 'pointer' }}>
      <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly'}}>
        <div>
          <Typography variant="h4" className="text-green-600 font-bold">
            {newContacts}
          </Typography>
          <Typography variant="body2" className="text-gray-600" sx={{width: '50px'}}>
            New
          </Typography>
          <Typography variant="body2" className="text-gray-600" sx={{width: '50px'}}>
            Contacts
          </Typography>
        </div>
        <Divider orientation="vertical" variant="middle" flexItem />
        <div>
          <Typography variant="h4" className="text-green-400 font-bold">
            {updatedContacts}
          </Typography>
          <Typography variant="body2" className="text-gray-600">
            Updated
          </Typography>
          <Typography variant="body2" className="text-gray-600">
            Contacts
          </Typography>
        </div>
      </Box>
    </Paper>
  );
}

export default function TotalRecordsCard({ summary, results = {
  totalRecords: 0,
  newContacts: [],
  updatedContacts: [],
  contributions: [],
  numberOfErrors: 0,
  errors: []
}, mode, tabularData }: TotalRecordsCardProps) {
  const [open, setOpen] = useState(false);
  const [popUpContent, setPopUpContent] = useState<modalData>({
    type: 'total',
    title: '',
    data: []
  });
  
  const handleOpen = (cardType: 'valid' | 'invalid' | 'total' | 'contacts' | 'contributions' | 'error') => {
    if (mode === 'preview' && !tabularData) return;
    
    let modalData: modalData;
    
    switch (cardType) {
      case 'total':
        if (mode === 'preview' && tabularData) {
          modalData = {
            type: 'total',
            title: 'Total Records',
            data: tabularData.contacts,
          };
        } else return;
        break;
      case 'valid':
        if (mode === 'preview' && tabularData) {
          // Filter valid contacts (those not in invalidContacts)
          const invalidContactIds = new Set(tabularData.invalidContacts.map(ic => ic.contact.external_identifier || ic.contact.email_primary));
          const validContacts = tabularData.validContacts.filter(contact => 
            !invalidContactIds.has(contact.external_identifier || '')
          );
          modalData = {
            type: 'valid',
            title: 'Valid Records',
            data: validContacts,
          };
        } else return;
        break;
      case 'invalid':
        if (mode === 'preview' && tabularData) {
          modalData = {
            type: 'invalid',
            title: 'Records Needing Review',
            data: tabularData.invalidContacts,
          };
        } else return;
        break;
      case 'contacts':
        modalData = {
          type: 'contacts',
          title: 'Contacts',
          data: [...results?.newContacts, ...results?.updatedContacts],
        };
        break;
      case 'contributions':
        modalData = {
          type: 'contributions',
          title: 'Contributions',
          data: results?.contributions,
        };
        break;  
      case 'error':
        modalData = {
          type: 'error',
          title: 'Errors',
          data: results.errors,
        };        
        break;  
    }
    
    setPopUpContent(modalData); 
    setOpen(true);
  };
  
  const handleClose = () => setOpen(false);

  if (mode === 'preview' && summary) {
    const metrics = [
      { value: summary.totalRecords, label: 'Total Records', colorClass: 'text-blue-600', type: 'total' as const },
      { value: summary.validRecords, label: 'Valid Records', colorClass: 'text-green-600', type: 'valid' as const },
      { value: summary.reviewRecords, label: 'Need Review', colorClass: 'text-orange-600', type: 'invalid' as const }
    ];
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {metrics.map((m) => 
            <MetricCard key={m.label} value={m.value} label={m.label} colorClass={m.colorClass} onClick={() => handleOpen(m.type)} />
        )}
        {popUpContent.data.length > 0 && <PopUpModal popUpContent={popUpContent} open={open} handleClose={handleClose} /> }
      </div>
    );
  }

  if (mode === 'results' && results) {
    const metrics = [
      { value: 0, label: 'Contacts', colorClass: 'text-green-600', type: 'contacts' as const },
      { value: results.contributions.length, label: 'Contributions', colorClass: 'text-blue-600', type: 'contributions' as const },
      { value: results.numberOfErrors, label: 'Errors', colorClass: 'text-red-600', type: 'error' as const }
    ];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" style={{justifyContent: 'center'}}>
        {metrics.map((m) => 
          m.type==='contacts' ? <ContactCard key={m.label} newContacts={results.newContacts.length} updatedContacts={results.updatedContacts.length} onClick={() => handleOpen(m.type)}/> : <MetricCard key={m.label} value={m.value} label={m.label} colorClass={m.colorClass} onClick={() => handleOpen(m.type)} />
        )}
        {popUpContent.data.length > 0 && <PopUpModal popUpContent={popUpContent} open={open} handleClose={handleClose} /> }
      </div>
    );
  }

  return null;
}
