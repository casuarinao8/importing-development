import React, { useState } from 'react';
import { Paper, Button, Typography, Box, Alert } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { ContactValidator } from '../components/validation-utils';
import { ImportContact } from '../../../proxy/contact/import/types';

interface UploadCSVProps {
  onUpload: (data: ImportContact[], fileName: string, fileSize: string) => Promise<void>;
  setContinueButton: (value: boolean) => void;
}

export default function UploadCSV({ onUpload, setContinueButton }: UploadCSVProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('Choose CSV File');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError('');
    setIsProcessing(true);

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file.');
      setIsProcessing(false);
      setContinueButton(false);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      setIsProcessing(false);
      setContinueButton(false);
      return;
    }

    try {
      const text = await file.text();
      const contacts = ContactValidator.parseCSV(text);
      
      if (contacts.length === 0) {
        setError('No valid data found in the CSV file. Please check the format.');
        setIsProcessing(false);
        setContinueButton(false);
        return;
      }

      const fileName = file.name;
      const fileSize = file.size.toString();
      setUploadedFileName(fileName);
      await onUpload(contacts, fileName, fileSize);
    } catch (err) {
      setError('Error reading the file. Please try again.');
      console.error('File reading error:', err);
      setContinueButton(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <h2 className='text-xl font-semibold mb-4'>Upload CSV File</h2>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      <Paper 
        className={`rounded-lg w-full h-64 border-2 border-dashed transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Box className="h-full flex flex-col items-center justify-center p-6">
          <CloudUpload className="text-4xl text-gray-400 mb-4" />
          
          <Typography variant="h6" className="mb-2 text-gray-600">
            {isProcessing ? 'Processing file...' : 'Drag & drop your CSV file here'}
          </Typography>
          
          <Typography variant="body2" className="text-gray-500 mb-4 text-center">
            or click the button below to browse files
          </Typography>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-upload"
            disabled={isProcessing}
          />
          
          <label htmlFor="csv-upload">
            <Button
              variant="contained"
              color="primary"
              component="span"
              disabled={isProcessing}
              startIcon={<CloudUpload />}
            >
              {isProcessing ? 'Processing...' : uploadedFileName}
            </Button>
          </label>

          <Typography variant="caption" className="text-gray-400 mt-4 text-center">
            Supported format: CSV files only<br />
            Maximum file size: 10MB
          </Typography>
        </Box>
      </Paper>
    </>
  );
}