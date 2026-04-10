import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ArrowBack, Download, Refresh, Visibility } from '@mui/icons-material';
import Papa from 'papaparse';
import Wrapper from '../../../components/wrapper';
import { Proxy } from '../../../proxy';
import { APIImportErrorReport } from '../../../proxy/contact/import/types';
import { downloadCSV } from '../../../utils/downloadCSV';

export default function ErrorReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<APIImportErrorReport[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<APIImportErrorReport | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const formatDateTime = (value?: string) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB');
  };

  const loadReports = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await Proxy.Contact.Import.getErrorReports(50);
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load saved error reports:', error);
      setErrorMessage('Failed to load saved error reports. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (runId: string) => {
    setOpen(true);
    setViewLoading(true);
    setSelectedReport(null);
    setErrorMessage(null);

    try {
      const report = await Proxy.Contact.Import.getErrorReportByRunId(runId);
      setSelectedReport(report);
    } catch (error) {
      console.error('Failed to load report details:', error);
      setErrorMessage('Failed to load report details.');
      setOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const buildCsvRows = (report: APIImportErrorReport) => {
    return report.errors.map((item, index) => ({
      'No.': index + 1,
      'Import Run ID': report.import_run_id,
      'Saved At': formatDateTime(report.updated_at),
      'Row Start': item.row ?? '',
      'Row End': item.row_end ?? '',
      'Field': item.field ?? '',
      'Error Message': item.message ?? '',
      'Contact Name': item.contact?.name ?? '',
      'Contact Type': item.contact?.contact_type ?? '',
      'External ID': item.contact?.external_identifier ?? '',
      'Email': item.contact?.email_primary ?? '',
      'Phone': item.contact?.phone_primary ?? '',
      'Transaction ID': item.contact?.contribution?.trxn_id ?? '',
      'Amount': item.contact?.contribution?.total_amount ?? '',
      'Contribution Date': item.contact?.contribution?.receive_date ?? '',
      'Imported Date': item.contact?.contribution?.imported_date ?? '',
      'Disbursement Batch Date': item.contact?.contribution?.received_date ?? '',
    }));
  };

  const handleDownloadReport = (report: APIImportErrorReport) => {
    const rows = buildCsvRows(report);
    const csv = Papa.unparse(rows, { header: true });
    const fileName = `import-error-report-${report.import_run_id}.csv`;
    downloadCSV(`\uFEFF${csv}`, fileName);
  };

  return (
    <Wrapper loading={loading}>
      <div className='max-w-[1200px] mx-auto py-4 px-4 h-full'>
        <div className='flex flex-wrap items-center justify-between gap-2 mb-4'>
          <h2 className='text-xl font-semibold'>Saved Error Reports</h2>
          <div className='flex gap-2'>
            <Button variant='outlined' startIcon={<ArrowBack />} onClick={() => navigate('/import')}>
              Back to Import
            </Button>
            <Button variant='contained' startIcon={<Refresh />} onClick={loadReports}>
              Refresh
            </Button>
          </div>
        </div>

        <Alert severity='info' className='mb-4'>
          Showing error logs from the last 30 days. Logs older than 30 days are deleted whenever a portal request is made.
        </Alert>

        {errorMessage && (
          <Alert severity='error' className='mb-4'>
            {errorMessage}
          </Alert>
        )}

        {!loading && reports.length === 0 && (
          <div className='flex items-center justify-center p-12 text-gray-500'>
            No saved error reports found yet.
          </div>
        )}

        {!loading && reports.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Updated At</strong></TableCell>
                  <TableCell><strong>Run ID</strong></TableCell>
                  <TableCell align='right'><strong>Errors</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.import_run_id}>
                    <TableCell>{formatDateTime(report.updated_at)}</TableCell>
                    <TableCell>{report.import_run_id}</TableCell>
                    <TableCell align='right'>
                      <Chip
                        size='small'
                        color={(report.totals?.errors ?? 0) > 0 ? 'error' : 'default'}
                        label={report.totals?.errors ?? 0}
                      />
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-2'>
                        <Button
                          size='small'
                          variant='outlined'
                          startIcon={<Visibility />}
                          onClick={() => handleViewReport(report.import_run_id)}
                        >
                          View
                        </Button>
                        <Button
                          size='small'
                          variant='contained'
                          startIcon={<Download />}
                          onClick={() => handleDownloadReport(report)}
                        >
                          CSV
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Dialog open={open} onClose={() => setOpen(false)} maxWidth='lg' fullWidth>
          <DialogTitle>Error Report Details</DialogTitle>
          <DialogContent>
            {viewLoading && (
              <Box className='flex items-center justify-center py-8'>
                <CircularProgress />
              </Box>
            )}

            {!viewLoading && selectedReport && (
              <Stack spacing={2}>
                <Typography variant='body2'>
                  <strong>Run ID:</strong> {selectedReport.import_run_id}
                </Typography>
                <Typography variant='body2'>
                  <strong>Updated:</strong> {formatDateTime(selectedReport.updated_at)}
                </Typography>
                <Typography variant='body2'>
                  <strong>Totals:</strong> {selectedReport.totals.contacts_processed} contacts, {selectedReport.totals.errors} errors
                </Typography>
                {selectedReport.errors_truncated && (
                  <Alert severity='warning'>
                    This report was truncated to the maximum saved error count.
                  </Alert>
                )}

                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>No.</strong></TableCell>
                        <TableCell><strong>Row</strong></TableCell>
                        <TableCell><strong>Field</strong></TableCell>
                        <TableCell><strong>Message</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedReport.errors.map((item, index) => (
                        <TableRow key={`${selectedReport.import_run_id}-${index}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            {item.row_end && item.row && item.row_end !== item.row
                              ? `${item.row}-${item.row_end}`
                              : item.row ?? '-'}
                          </TableCell>
                          <TableCell>{item.field}</TableCell>
                          <TableCell>{item.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box className='flex justify-end'>
                  <Button variant='contained' startIcon={<Download />} onClick={() => handleDownloadReport(selectedReport)}>
                    Download This Report
                  </Button>
                </Box>
              </Stack>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Wrapper>
  );
}
