import { Paper, Table, TableBody, TableCell, TableContainer, TableRow } from '@mui/material';
import { ImportResults, ImportSummary } from '../../../proxy/contact/import/types';

interface ImportSummaryProps {
  summary: ImportSummary;
  result?: ImportResults;
  mode: 'preview' | 'results';
}

export default function ImportSummaryComponent({ summary, result, mode }: ImportSummaryProps) {

  return (
    <Paper className="p-6 md:p-10 mb-6 shadow-md justify-between items-center rounded-lg w-full">
      <h3 className='text-xl font-semibold mb-4'>
        {mode === 'preview' ? 'Pre-Import Summary' : 'Import Summary'}
      </h3>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
          <TableBody>
            {mode === 'preview' && (
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell 
                  align='right' 
                  className={`font-medium ${
                    summary.reviewRecords === 0 
                      ? 'text-green-600' 
                      : summary.validRecords === 0 
                        ? 'text-red-600' 
                        : 'text-blue-600'
                  }`}
                  >
                    {summary.reviewRecords === 0 
                    ? 'Ready to Import' 
                    : summary.validRecords === 0 
                      ? 'Fail to Import' 
                      : 'Ready to Import'}
                </TableCell>
              </TableRow>
            )}

            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell align='right'>{summary.fileName || 'N/A'}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell>Total Records</TableCell>
              <TableCell align='right'>{summary.totalRecords}</TableCell>
            </TableRow>

            {mode === 'preview' && (
              <TableRow>
                <TableCell>Valid Records</TableCell>
                <TableCell align='right'>{summary.validRecords}</TableCell>
              </TableRow>
            )}

            {mode === 'results' && (
              <TableRow>
                <TableCell>New Contacts</TableCell>
                <TableCell align='right'>{result?.newContacts.length}</TableCell>
              </TableRow>
            )}

            {mode === 'results' && (
              <TableRow>
                <TableCell>Updated Contacts</TableCell>
                <TableCell align='right'>{result?.updatedContacts.length}</TableCell>
              </TableRow>
            )}

            {mode === 'results' && (
              <TableRow>
                <TableCell>Error Imports</TableCell>
                <TableCell align='right'>{result?.numberOfErrors}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
