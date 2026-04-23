import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogContentText } from '@mui/material';
import { modalData } from './total-records-card';
import { ImportContact, ValidationError } from '../../../proxy/contact/import/types';

interface PopUpModalProps {
  popUpContent: modalData | undefined;
  open: boolean;
  handleClose: () => void;
}

const baseHeaders = [
  { label: 'Contact Type', key: 'contact_type' },
  { label: 'Salutation Code', key: 'prefix_id' },
  { label: 'Name', key: 'name' },
  { label: 'Preferred Name', key: 'preferred_name' },
  { label: 'External ID', key: 'external_identifier' },
  { label: 'Email', key: 'email_primary' },
  { label: 'Phone', key: 'phone_primary' },
  { label: 'Street Address', key: 'street_address' },
  { label: 'Floor & Unit Number', key: 'unit_floor_number' },
  { label: 'Postal Code', key: 'postal_code' },
  { label: 'Financial Type', key: 'financial_type' },
  { label: 'Financial Type Code', key: 'financial_type_id' },
  { label: 'Donation Status Code', key: 'contribution_status_id' },
  { label: 'Total Amount', key: 'total_amount' },
  { label: 'Contribution Source', key: 'source' },
  { label: 'Campaign Code', key: 'Additional_Contribution_Details.Campaign' },
  { label: 'Date Received', key: 'receive_date' },
  { label: 'Payment Method Code', key: 'payment_instrument_id' },
  { label: 'Transaction ID', key: 'trxn_id' },
  { label: 'Cheque Number', key: 'check_number' },
  { label: 'NRIC/FIN/UEN', key: 'Additional_Contribution_Details.NRIC_FIN_UEN' },
  { label: 'Donation Platform Code', key: 'Additional_Contribution_Details.Payment_Platform' },
  { label: 'Frequency Code', key: 'Additional_Contribution_Details.Recurring_Donation' },
  { label: 'Remarks', key: 'Additional_Contribution_Details.Remarks' },
  { label: 'Imported Date', key: 'Additional_Contribution_Details.Imported_Date' },
  { label: 'Disbursement Batch Date', key: 'Additional_Contribution_Details.Received_Date' },
];

const mindsHeaders = [
  { label: 'Subsidiary', key: 'Additional_Contribution_Details.Subsidiary' },
  { label: 'Bank Account', key: 'Additional_Contribution_Details.Donation_Bank_Account' },
  { label: 'Department', key: 'Additional_Contribution_Details.Department' },
  { label: 'Resources', key: 'Additional_Contribution_Details.Resources' },
  { label: 'Projects', key: 'Additional_Contribution_Details.Projects' },
  { label: 'Account Code', key: 'Additional_Contribution_Details.Account_Code' },
  { label: 'Transaction date / Bank-in Date', key: 'Additional_Contribution_Details.Transaction_Date_Bank_In_Date' },
  { label: 'Bank Reference No', key: 'Additional_Contribution_Details.Bank_Reference_No' },
];

export default function PopUpModal({ popUpContent, open, handleClose }: PopUpModalProps) {
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && isNaN(value)) return '';
    if (typeof value === 'string') return value;
    return String(value);
  };

  if (!popUpContent) return null;

  const hasDisbursementDate = (() => {
    if (popUpContent.type === 'valid' || popUpContent.type === 'total') {
      const contacts = popUpContent.data as ImportContact[];
      return contacts.some(c => c.contribution?.['Additional_Contribution_Details.Received_Date']);
    }
    if (popUpContent.type === 'invalid') {
      const items = popUpContent.data as Array<{ contact: ImportContact }>;
      return items.some(item => item.contact.contribution?.['Additional_Contribution_Details.Received_Date']);
    }
    if (popUpContent.type === 'contributions') {
      const contributions = popUpContent.data as any[];
      return contributions.some(c => c.received_date);
    }
    return false;
  })();

  const hasMindsColumns = (() => {
    if (popUpContent.type === 'valid' || popUpContent.type === 'total') {
      const contacts = popUpContent.data as ImportContact[];
      return contacts.some(c => (
        c.import_template === 'MINDS' ||
        c.contribution?.['Additional_Contribution_Details.Subsidiary'] ||
        c.contribution?.['Additional_Contribution_Details.Donation_Bank_Account'] ||
        c.contribution?.['Additional_Contribution_Details.Department'] ||
        c.contribution?.['Additional_Contribution_Details.Resources'] ||
        c.contribution?.['Additional_Contribution_Details.Projects'] ||
        c.contribution?.['Additional_Contribution_Details.Account_Code'] ||
        c.contribution?.['Additional_Contribution_Details.Transaction_Date_Bank_In_Date'] ||
        c.contribution?.['Additional_Contribution_Details.Bank_Reference_No']
      ));
    }
    if (popUpContent.type === 'invalid') {
      const items = popUpContent.data as Array<{ contact: ImportContact }>;
      return items.some(item => (
        item.contact.import_template === 'MINDS' ||
        item.contact.contribution?.['Additional_Contribution_Details.Subsidiary'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Donation_Bank_Account'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Department'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Resources'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Projects'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Account_Code'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Transaction_Date_Bank_In_Date'] ||
        item.contact.contribution?.['Additional_Contribution_Details.Bank_Reference_No']
      ));
    }
    if (popUpContent.type === 'contributions') {
      const contributions = popUpContent.data as any[];
      return contributions.some(c => (
        c.subsidiary ||
        c.donation_bank_account ||
        c.department ||
        c.resources ||
        c.projects ||
        c.account_code ||
        c.transaction_date_bank_in_date ||
        c.bank_reference_no
      ));
    }
    return false;
  })();

  const filteredHeaders = [
    ...(hasDisbursementDate
      ? baseHeaders
      : baseHeaders.filter(h => h.key !== 'Additional_Contribution_Details.Received_Date')),
    ...(hasMindsColumns ? mindsHeaders : []),
  ];

  const getContactCellValue = (contact: ImportContact, key: string): string => {
    const contactRecord = contact as unknown as Record<string, unknown>;
    if (key in contactRecord && key !== 'contribution') {
      return formatCellValue(contactRecord[key]);
    }
    const contributionRecord = contact.contribution as unknown as Record<string, unknown>;
    return formatCellValue(contributionRecord[key]);
  };

  const renderValidRecordsTable = () => {
    const contacts = popUpContent.data as ImportContact[];

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>No.</TableCell>
              {filteredHeaders.map((header) => (
                <TableCell key={header.key}><strong>{header.label}</strong></TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {contacts.map((contact, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                {filteredHeaders.map((header) => (
                  <TableCell key={header.key}>{getContactCellValue(contact, header.key)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderInvalidRecordsTable = () => {
    const invalidContacts = popUpContent.data as Array<{
      contact: ImportContact;
      errors: Array<{ field: string; message: string }>;
    }>;

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>No.</TableCell>
              <TableCell>Errors</TableCell>
              {filteredHeaders.map((header) => (
                <TableCell key={header.key}><strong>{header.label}</strong></TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {invalidContacts.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <div className='text-red-600 text-sm'>
                    {item.errors?.map((e: { message: string }) => e.message).join(', ') ?? ''}
                  </div>
                </TableCell>
                {filteredHeaders.map((header) => (
                  <TableCell key={header.key}>{getContactCellValue(item.contact, header.key)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderTotalRecordsTable = () => {
    const contacts = popUpContent.data as ImportContact[];

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>No.</TableCell>
              {filteredHeaders.map((header) => (
                <TableCell key={header.key}><strong>{header.label}</strong></TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {contacts.map((contact, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                {filteredHeaders.map((header) => (
                  <TableCell key={header.key}>{getContactCellValue(contact, header.key)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderImportedContactsTable = () => {
    const contacts = popUpContent.data as ImportContact[];

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>No.</strong></TableCell>
              <TableCell><strong>Contact ID</strong></TableCell>
              <TableCell><strong>New/Updated</strong></TableCell>
              <TableCell><strong>Contact Type</strong></TableCell>
              <TableCell><strong>Salutation Code</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Preferred Name</strong></TableCell>
              <TableCell><strong>External ID</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Street Address</strong></TableCell>
              <TableCell><strong>Floor & Unit Number</strong></TableCell>
              <TableCell><strong>Postal Code</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contacts.map((contact, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                {Object.entries(contact).map(([field, value], cellIndex) => (
                  <TableCell key={`${field}-${cellIndex}`}>
                    {typeof value === 'object' ? '' : (field === 'row' || field === 'contribution_id' ? '' : value) ?? ''}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderImportedContributionsTable = () => {
    const contributions = popUpContent.data as any[];
    const hasMindsContributionColumns = contributions.some(c => (
      c.subsidiary ||
      c.donation_bank_account ||
      c.department ||
      c.resources ||
      c.projects ||
      c.account_code ||
      c.transaction_date_bank_in_date ||
      c.bank_reference_no
    ));

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>No.</strong></TableCell>
              <TableCell><strong>Contact ID</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Contribution ID</strong></TableCell>
              <TableCell><strong>TDR/NTDR</strong></TableCell>
              <TableCell><strong>Total Amount</strong></TableCell>
              <TableCell><strong>Received Date</strong></TableCell>
              <TableCell><strong>Transaction ID</strong></TableCell>
              <TableCell><strong>Campaign</strong></TableCell>
              <TableCell><strong>Platform</strong></TableCell>
              <TableCell><strong>Frequency</strong></TableCell>
              <TableCell><strong>Remarks</strong></TableCell>
              <TableCell><strong>Imported Date</strong></TableCell>
              {hasDisbursementDate && <TableCell><strong>Disbursement Batch Date</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Subsidiary</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Bank Account</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Department</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Resources</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Projects</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Account Code</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Transaction date / Bank-in Date</strong></TableCell>}
              {hasMindsContributionColumns && <TableCell><strong>Bank Reference No</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {contributions.map((contribution, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{contribution.contact_id}</TableCell>
                <TableCell>{contribution?.name ?? ''}</TableCell>
                <TableCell><strong>{contribution.contribution_id}</strong></TableCell>
                <TableCell>{contribution.financial_type}</TableCell>
                <TableCell>${contribution.total_amount}</TableCell>
                <TableCell>{new Date(contribution.receive_date).toLocaleDateString('en-GB')}</TableCell>
                <TableCell>{contribution.trxn_id}</TableCell>
                <TableCell>{contribution.campaign_name}</TableCell>
                <TableCell>{contribution.platform}</TableCell>
                <TableCell>{contribution.frequency}</TableCell>
                <TableCell>{contribution.remarks}</TableCell>
                <TableCell>{contribution.imported_date}</TableCell>
                {hasDisbursementDate && <TableCell>{contribution.received_date ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.subsidiary ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.donation_bank_account ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.department ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.resources ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.projects ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.account_code ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.transaction_date_bank_in_date ?? ''}</TableCell>}
                {hasMindsContributionColumns && <TableCell>{contribution.bank_reference_no ?? ''}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderImportErrorRecordsTable = () => {
    const importErrors = popUpContent.data as Array<{ contact?: ImportContact; errors?: ValidationError[]; message?: string }>;

    if (!Array.isArray(importErrors) || importErrors.length === 0) {
      return (
        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>No errors found</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      );
    }

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>No.</strong></TableCell>
              <TableCell><strong>Errors</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {importErrors.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <div className='text-red-600 text-sm'>
                    {item.message && item.message}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return <>
    <Dialog
      maxWidth='lg'
      open={open}
      scroll='paper'
      onClose={handleClose}
      sx={{ height: '90%', maxHeight: '90%' }}
    >
      <DialogTitle className='py-3 mt-3' sx={{ fontWeight: 'bold' }}>{popUpContent.title}</DialogTitle>
      <DialogContent>
        <Box display='flex' justifyContent='space-between'>
          <DialogContentText>Total Rows: {popUpContent.data.length}</DialogContentText>
          <Box display='flex' justifyContent='space-between'>
            {/* reserved for future toolbar actions */}
          </Box>
        </Box>
        <Box
          noValidate
          component='form'
          sx={{
            display: 'flex',
            flexDirection: 'column',
            m: 'auto',
            width: 'fit-content',
          }}
        >
          <Box sx={{ mt: 1 }}>
            {popUpContent.type === 'valid' && renderValidRecordsTable()}
            {popUpContent.type === 'invalid' && renderInvalidRecordsTable()}
            {popUpContent.type === 'total' && renderTotalRecordsTable()}
            {popUpContent.type === 'contacts' && renderImportedContactsTable()}
            {popUpContent.type === 'contributions' && renderImportedContributionsTable()}
            {popUpContent.type === 'error' && renderImportErrorRecordsTable()}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  </>;
}
