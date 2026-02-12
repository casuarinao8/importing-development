import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Wrapper from '../../../components/wrapper';
import { APIContact, APIContactType } from '../../../proxy/contact/types';
import { Proxy } from '../../../proxy';
import { APICustomField } from '../../../proxy/custom-fields/types';
import { Alert, Snackbar, Divider, FormControlLabel, Checkbox, Typography, FormGroup, Grid2, Select, FormControl, MenuItem, Box, FormLabel } from '@mui/material';
import { FormatListBulleted, ContentCopy, AccountCircleOutlined } from '@mui/icons-material';
import { FaCheck, FaCircleInfo } from 'react-icons/fa6';
import ActionButton from '../action-button';
// import { ContactValidator } from '../components/validation-utils';

export default function Settings() {
  const navigate = useNavigate();
  const [contactTypes, setContactTypes] = useState<APIContactType[]>([]);
  const [addiContriFields, setAddiContriFields] = useState<APICustomField[]>([]);
  const [contact, setContact] = useState<APIContact>();
  
  // Settings state
  const defaultSettings = {
    import_dedupe_rule: 'external_identifier',
    import_contact_types: [] as string[],
    import_custom_fields: [] as string[]
  };
  
  const [settings, setSettings] = useState(defaultSettings);
  const [oldSettings, setOldSettings] = useState(defaultSettings);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load contact types
      const types = await Proxy.Contact.getContactTypes();
      setContactTypes(types);

      // Load custom fields
      const fields = await Proxy.CustomField.getFieldsBySetName('Additional_Contribution_Details');
      console.log("additional contribution fields: ", fields);
      
      setAddiContriFields(fields);
      
      // Load current user
      const currentContact = await Proxy.Contact.getSelf();
      setContact(currentContact);

      // Load saved settings
      await loadSettings();
    } catch (error) {
      console.error('Error loading data:', error);
      setWarningMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const result = await Proxy.Contact.Import.getImportSettings();
      console.log('getImportSettings: ', result);
      
      if (result && result.length > 0) {
        // Convert array of settings to a map for easy access
        const settingsMap = result.reduce((acc, setting) => {
          acc[setting.name] = setting.value;
          return acc;
        }, {} as Record<string, any>);
        
        const loadedSettings = {
          import_dedupe_rule: settingsMap['import_dedupe_rule'] || 'external_identifier',
          import_contact_types: settingsMap['import_contact_types'] || [],
          import_custom_fields: settingsMap['import_custom_fields'] || []
        };
        
        setSettings(loadedSettings);
        setOldSettings(loadedSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    console.log('settings: ', settings);
    console.log('oldSettings: ', oldSettings);

    try {
      await Proxy.Contact.Import.setImportSettings(settings);
      
      setOldSettings(settings);
      setSuccessMessage('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      setWarningMessage('Failed to save settings');
    } finally {
      // ContactValidator.clearCache();
      setSaving(false);
    }
  };

  const handleContactTypeChange = (contactTypeId: string) => {
    setSettings(prev => ({
      ...prev,
      import_contact_types: prev.import_contact_types.includes(contactTypeId)
        ? prev.import_contact_types.filter(id => id !== contactTypeId)
        : [...prev.import_contact_types, contactTypeId]
    }));
  };

  const handleCustomFieldChange = (fieldName: string) => {
    setSettings(prev => ({
      ...prev,
      import_custom_fields: prev.import_custom_fields.includes(fieldName)
        ? prev.import_custom_fields.filter(name => name !== fieldName)
        : [...prev.import_custom_fields, fieldName]
    }));
  };

  return <>
    <Snackbar open={!!successMessage} autoHideDuration={3000} onClose={() => setSuccessMessage(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <Alert className='shadow-lg' icon={<FaCheck className='text-inherit' />} onClose={() => setSuccessMessage(null)} severity='success'>
        {successMessage}
      </Alert>
    </Snackbar>
    <Snackbar open={!!warningMessage} autoHideDuration={3000} onClose={() => setWarningMessage(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <Alert className='shadow-lg' onClose={() => setWarningMessage(null)} severity='warning'>
        {warningMessage}
      </Alert>
    </Snackbar>

    <Wrapper loading={loading}>
      {!!contact && <div className='max-w-[1200px] mx-auto py-4 px-4 h-full'>
        <h2 className='text-xl font-semibold my-4'>Import Settings</h2>
        <form className='bg-white shadow-lg rounded-lg p-6' onSubmit={handleSave}>
          {/* Dedupe Rules Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} className="text-primary">
              <ContentCopy className="text-lg text-black-400" />
              <Typography variant='h6' sx={{ fontWeight: 600, m: 0 }}>Dedupe Rules</Typography>
            </Box>
            <Typography variant='body2' sx={{ color: '#666', mb: 2 }}>Choose how to identify and handle duplicate contacts during import</Typography>
            
            <FormControl sx={{ minWidth: 250, mb: 2 }}>
              <FormLabel sx={{ mb: 1, fontWeight: 500 }}>Deduplication Method</FormLabel>
              <Select
                value={settings.import_dedupe_rule}
                onChange={(e) => setSettings(prev => ({ ...prev, import_dedupe_rule: e.target.value }))}
                size='small'
              >
                <MenuItem value="external_identifier">External Identifier</MenuItem>
                <MenuItem value="email_primary">Email</MenuItem>
                <MenuItem value="phone_primary">Phone</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, backgroundColor: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
              <FaCircleInfo size={16} style={{ marginTop: '2px', color: '#999', flexShrink: 0 }} />
              <Typography variant='body2' sx={{ color: '#666' }}>Existing contacts matching the selected identifier will be updated instead of creating duplicates</Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Contact Types Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} className="text-primary">
              <AccountCircleOutlined className="text-lg text-black-400" />
              <Typography variant='h6' sx={{ fontWeight: 600, m: 0 }}>Contact Types</Typography>
            </Box>
            <Typography variant='body2' sx={{ color: '#666', mb: 3 }}>Select which contact types should be included in the import process</Typography>
            
            <FormGroup>
              <Grid2 container spacing={3}>
                {contactTypes.map(contactType => (
                  <Grid2 key={contactType.id} sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '200px' }}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={settings.import_contact_types.includes(contactType.name)}
                          onChange={() => handleContactTypeChange(contactType.name)}
                          sx={{paddingTop: 0, paddingBottom: 0}}
                        />
                      }
                      label={contactType.label}
                      labelPlacement="end"
                    />
                  </Grid2>
                ))}
              </Grid2>
            </FormGroup>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Custom Fields Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} className="text-primary">
              <FormatListBulleted className="text-lg text-black-400" />
              <Typography variant='h6' sx={{ fontWeight: 600, m: 0 }}>Custom Fields</Typography>
            </Box>
            <Typography variant='body2' sx={{ color: '#666', mb: 3 }}>Select additional contribution fields to include in the import</Typography>
            
            <FormGroup>
              <Grid2 container spacing={3}>
                {addiContriFields.map(field => (
                  <Grid2 key={field.id} sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '200px',}}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={settings.import_custom_fields.includes(field.name)}
                          onChange={() => handleCustomFieldChange(field.name)}
                          sx={{paddingTop: 0, paddingBottom: 0}}
                        />
                      }
                      label={field.label}
                      labelPlacement="end"
                    />
                  </Grid2>
                ))}
              </Grid2>
            </FormGroup>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 6, pt: 3, borderTop: '1px solid #e0e0e0' }}>
            <ActionButton actionName='Cancel' variant='outlined' disabled={saving} onClick={() => navigate('/import')} />
            <ActionButton actionName={saving ? 'Saving...' : 'Save Settings'} variant='contained' disabled={saving} type='submit' />
          </Box>
        </form>
      </div>}
    </Wrapper>
  </>;
}