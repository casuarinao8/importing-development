import './main.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Root from './pages/root';
import { SubtypesProvider } from './contexts/Contact';
import { createTheme, StyledEngineProvider, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import twConfig from '../tailwind.config';
import NotFound from './pages/not-found';
import DataImport from './pages/import/';
import Settings from './pages/import/settings';
import ErrorReports from './pages/import/error-reports';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

const theme = createTheme({
  palette: {
    primary: {
      main: twConfig.theme.extend.colors.primary.DEFAULT,
      light: twConfig.theme.extend.colors.primary.lighter,
      dark: twConfig.theme.extend.colors.primary.dark,
      contrastText: '#fff'
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
          <SubtypesProvider>
            <HashRouter>
              <Routes>
                <Route path='*' element={<NotFound />} />
                <Route path='/' index element={<Root />} />
                <Route path='/import' element={<DataImport />} />
                <Route path='/import/settings' element={<Settings />} />
                <Route path='/import/error-reports' element={<ErrorReports />} />
              </Routes>
            </HashRouter>
          </SubtypesProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>
);
