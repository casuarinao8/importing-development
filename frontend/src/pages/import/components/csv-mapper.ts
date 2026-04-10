import Papa from 'papaparse';
import { ImportContact } from '../../../proxy/contact/import/types';
import { Proxy } from '../../../proxy';
import { APICustomField, APIOptionValue } from '../../../proxy/custom-fields/types';
import { ContactValidator } from './validation-utils';

export type UploadCSVFormat = 'mapped-template' | 'giving-sg-raw' | 'giveasia-raw' | 'benevity-raw' | 'adhoc-raw' | 'unknown';

export interface ParsedUploadCSVResult {
  contacts: ImportContact[];
  format: UploadCSVFormat;
}

interface DynamicCodeMaps {
  salutation: Record<string, number>;
  frequency: Record<string, number>;
  campaign: Record<string, number>;
  platform: Record<string, number>;
  financialType: Record<string, number>;
  contributionStatus: Record<string, number>;
  paymentMethod: Record<string, number>;
}

const DEFAULT_ANONYMOUS_NAME = 'Anonymous Donor';
const DEFAULT_ANONYMOUS_EXTERNAL_ID = 'sample-id';
const DEFAULT_ANONYMOUS_EMAIL = 'anonymousdonor@o8.com';

const SALUTATION_CODE_MAP: Record<string, number> = {
  MRS: 1,
  MS: 2,
  MR: 3,
  DR: 4,
  MISS: 5,
  MDM: 6,
  MADAM: 6
};

const FREQUENCY_CODE_MAP: Record<string, number> = {
  YES: 1,
  RECURRING: 1,
  MONTHLY: 1,
  NO: 2,
  ONETIME: 2,
  'ONE TIME': 2,
  'ONE OFF': 2,
  ONCE: 2
};

const CAMPAIGN_CODE_MAP: Record<string, number> = {
  'TEA PARTY CAMPAIGN': 4,
  'GENERAL DONATION': 5,
  'GOLF CHARITY CAMPAIGN': 6,
  'CHRISTMAS PARTY CAMPAIGN': 7,
  FUNDRAISING: 8,
  'HIGH TEA CAMPAIGN': 9,
  'NEW YEAR DRIVE': 10
};

const PLATFORM_CODE_MAP: Record<string, number> = {
  WEBSITE: 1,
  GIVINGSG: 2,
  BENEVITY: 3,
  'BENEVITY CAUSES': 3,
  'DIRECT DONATION': 4,
  INTERNAL: 5,
  GIVEASIA: 6,
  SIMPLYGIVING: 4,
  ADHOC: 9
};

const FINANCIAL_TYPE_CODE_MAP: Record<string, number> = {
  YES: 5,
  TDR: 5,
  'TAX DEDUCTIBLE DONATION': 5,
  NO: 6,
  NTDR: 6,
  'NON TAX DEDUCTIBLE DONATION': 6,
  'YES NOT ELIGIBLE': 6,
  'DONATION IN KIND': 7,
  DIK: 7
};

const CONTRIBUTION_STATUS_CODE_MAP: Record<string, number> = {
  COMPLETED: 1,
  SUCCESSFUL: 1,
  'FUND DISBURSED': 1,
  PENDING: 2,
  CANCELLED: 3,
  CANCELED: 3,
  FAILED: 4,
  REFUNDED: 7,
  'PARTIALLY PAID': 8,
  'PENDING REFUND': 9,
  CHARGEBACK: 10,
  TEMPLATE: 11
};

const PAYMENT_METHOD_CODE_MAP: Record<string, number> = {
  'CREDIT CARD': 1,
  PAYNOW: 2,
  'PAY NOW': 2,
  CASH: 3,
  CHEQUE: 4,
  CHECK: 4,
  EFT: 5,
  'BANK TRANSFER': 6,
  GIRO: 7,
  GIVEASIA: 8,
  ADHOC: 9,
  BENEVITY: 10,
  'DONATION IN KIND': 9,
  ENETS: 10,
  GRABPAY: 11
};

const BENEVITY_USD_TO_SGD_RATE = 1.3;

export class UploadCsvMapper {
  private static codeMapsPromise: Promise<DynamicCodeMaps> | null = null;
  private static readonly FORMAT_DETECTION_SAMPLE_SIZE = 50;

  static async parse(csvText: string): Promise<ParsedUploadCSVResult> {
    const rowParse = Papa.parse<string[]>(csvText, {
      skipEmptyLines: 'greedy'
    });
    const rows = rowParse.data;

    if (!rows.length) {
      return {
        contacts: [],
        format: 'unknown'
      };
    }

    const detectedFormat = this.detectFormat(rows);

    if (detectedFormat === 'giving-sg-raw') {
      return {
        contacts: await this.parseGivingSgRaw(rows),
        format: detectedFormat
      };
    }

    if (detectedFormat === 'giveasia-raw') {
      return {
        contacts: await this.parseGiveAsiaRaw(rows),
        format: detectedFormat
      };
    }

    if (detectedFormat === 'benevity-raw') {
      return {
        contacts: await this.parseBenevityRaw(rows),
        format: detectedFormat
      };
    }

    if (detectedFormat === 'adhoc-raw') {
      return {
        contacts: await this.parseAdhocRaw(rows),
        format: detectedFormat
      };
    }

    const mappedContacts = ContactValidator.parseCSV(csvText);
    return {
      contacts: mappedContacts,
      format: mappedContacts.length > 0 ? 'mapped-template' : detectedFormat
    };
  }

  private static detectFormat(rows: string[][]): UploadCSVFormat {
    const sampleRows = rows.slice(0, this.FORMAT_DETECTION_SAMPLE_SIZE);

    if (sampleRows.some((row) => this.isMappedTemplateHeaderRow(row))) {
      return 'mapped-template';
    }

    if (sampleRows.some((row) => this.isGivingSgHeaderRow(row) || this.looksLikeGivingSgDataRow(row))) {
      return 'giving-sg-raw';
    }

    if (sampleRows.some((row) => this.looksLikeGiveAsiaDataRow(row))) {
      return 'giveasia-raw';
    }

    if (sampleRows.some((row) => this.looksLikeBenevityDataRow(row))) {
      return 'benevity-raw';
    }

    if (sampleRows.some((row) => this.looksLikeAdhocDataRow(row))) {
      return 'adhoc-raw';
    }

    return 'unknown';
  }

  private static isMappedTemplateHeaderRow(row: string[]): boolean {
    const normalizedHeaders = row.map((value) => this.normalizeHeader(value));

    return (
      normalizedHeaders.includes('contact type') &&
      (normalizedHeaders.includes('financial type code') ||
        normalizedHeaders.includes('payment method code') ||
        normalizedHeaders.includes('total amount in sgd'))
    );
  }

  private static isGivingSgHeaderRow(row: string[]): boolean {
    const normalizedHeaders = row.map((value) => this.normalizeHeader(value));
    return (
      normalizedHeaders.includes('donation reference') &&
      normalizedHeaders.includes('donation amount') &&
      normalizedHeaders.includes('payment method')
    );
  }

  private static looksLikeGivingSgDataRow(row: string[]): boolean {
    if (!row || row.length < 24) {
      return false;
    }

    const donationDate = this.cleanCell(row[0]);
    const donationReference = this.cleanCell(row[1]);
    const amount = this.cleanCell(row[6]);
    const paymentMethod = this.cleanCell(row[7]);
    const status = this.cleanCell(row[22]);

    const looksLikeDate = this.isDayMonthYearDate(donationDate);
    const looksLikeReference = /^[A-Za-z0-9/-]{6,}$/.test(donationReference);
    const looksLikeAmount = !Number.isNaN(Number(amount));
    const looksLikeStatus = ['FUND DISBURSED', 'COMPLETED', 'SUCCESSFUL', 'PENDING', 'CANCELLED'].includes(
      this.normalizeLookupValue(status)
    );

    return looksLikeDate && looksLikeReference && looksLikeAmount && (!!paymentMethod || looksLikeStatus);
  }

  private static looksLikeBenevityDataRow(row: string[]): boolean {
    if (!row || row.length < 18) {
      return false;
    }

    const dateTime = this.cleanCell(row[2]);
    const email = this.cleanCell(row[5]);
    const transactionId = this.cleanCell(row[12]);
    const frequency = this.cleanCell(row[13]);

    return (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2})?$/.test(dateTime) &&
      email.includes('@') &&
      /^[A-Za-z0-9]{8,}$/.test(transactionId) &&
      ['ONE TIME', 'RECURRING', 'MONTHLY'].includes(this.normalizeLookupValue(frequency))
    );
  }

  private static looksLikeAdhocDataRow(row: string[]): boolean {
    if (!row || row.length < 16) {
      return false;
    }

    const amount = this.cleanCell(row[11]);
    const receiveDate = this.cleanCell(row[12]);
    const paymentMethod = this.cleanCell(row[13]);
    const status = this.cleanCell(row[18]);

    const looksLikeDate = /^\d{2}\/\d{2}\/\d{4}$/.test(receiveDate);
    const looksLikeAmount = !Number.isNaN(Number(amount));
    const looksLikeStatus = ['COMPLETED', 'CANCELLED', 'PENDING', 'FAILED'].includes(this.normalizeLookupValue(status));
    const looksLikePaymentMethod = ['CASH', 'CHEQUE', 'PAYNOW', 'BANK TRANSFER', 'CREDIT CARD'].includes(
      this.normalizeLookupValue(paymentMethod)
    );

    return looksLikeDate && looksLikeAmount && looksLikeStatus && looksLikePaymentMethod;
  }

  private static looksLikeGiveAsiaDataRow(row: string[]): boolean {
    if (!row || row.length < 12) {
      return false;
    }

    const firstCell = this.cleanCell(row[0]);
    const platformCell = this.cleanCell(row[14] ?? '');

    return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(firstCell) || platformCell.toLowerCase() === 'give.asia';
  }

  private static async parseGivingSgRaw(rows: string[][]): Promise<ImportContact[]> {
    const headerRowIndex = this.findGivingSgHeaderRowIndex(rows);

    if (headerRowIndex >= 0) {
      return this.parseGivingSgRawWithHeaders(rows.slice(headerRowIndex));
    }

    return this.parseGivingSgRawWithoutHeaders(rows);
  }

  private static findGivingSgHeaderRowIndex(rows: string[][]): number {
    return rows.findIndex((row) => this.isGivingSgHeaderRow(row));
  }

  private static async parseGivingSgRawWithHeaders(rows: string[][]): Promise<ImportContact[]> {
    if (!rows.length) {
      return [];
    }

    const headerRow = rows[0].map((value) => this.cleanCell(value));
    const normalizedHeaders = headerRow.map((value) => this.normalizeHeader(value));
    const codeMaps = await this.getCodeMaps();
    const contacts: ImportContact[] = [];

    rows.slice(1).forEach((row) => {
      const normalizedRow = this.normalizeRowByHeaders(row, normalizedHeaders);
      if (!Object.values(normalizedRow).some((value) => value !== '')) {
        return;
      }

      const contact = this.createGivingSgContact(
        {
          donationDate: this.pickValue(normalizedRow, ['Donation Date', 'Donation Date DD/MM/YYYY']),
          donationReference: this.pickValue(normalizedRow, ['Donation Reference']),
          campaignName: this.pickValue(normalizedRow, ['Campaign Name']),
          disbursementDate: this.pickValue(normalizedRow, ['Disbursement Batch Date', 'Disbursement Batch Date DD/MM/YYYY']),
          donationAmount: this.pickValue(normalizedRow, ['Donation Amount']),
          paymentMethod: this.pickValue(normalizedRow, ['Payment Method']),
          accountEmail: this.pickValue(normalizedRow, ['Account Email']),
          salutation: this.pickValue(normalizedRow, ['Salutation']),
          donorName: this.pickValue(normalizedRow, ['Donor Name']),
          preferredDisplayName: this.pickValue(normalizedRow, ['Preferred Display Name']),
          externalIdentifierRaw: this.pickValue(normalizedRow, ['Donor NRIC/FIN']),
          postalCode: this.pickValue(normalizedRow, ['Postal Code']),
          donationType: this.pickValue(normalizedRow, ['Donation Type']),
          transactionStatus: this.pickValue(normalizedRow, ['Transaction Status']),
          remarks: this.pickValue(normalizedRow, ['Remarks']),
          taxDeduction: this.pickValue(normalizedRow, ['TDR', 'Tax Deduction', 'Tax Deduction/FinancialType']),
          npoName: this.pickValue(normalizedRow, ['NPO Name']),
          campaignType: this.pickValue(normalizedRow, ['Campaign Type']),
          address1: this.pickValue(normalizedRow, ['Address 1']),
          address2: this.pickValue(normalizedRow, ['Address 2']),
          block: this.pickValue(normalizedRow, ['Block']),
          street: this.pickValue(normalizedRow, ['Street']),
          buildingName: this.pickValue(normalizedRow, ['Building Name']),
          floor: this.pickValue(normalizedRow, ['Floor']),
          unitNumber: this.pickValue(normalizedRow, ['Unit Number'])
        },
        codeMaps
      );

      if (contact) {
        contacts.push(contact);
      }
    });

    return contacts;
  }

  private static async parseGivingSgRawWithoutHeaders(rows: string[][]): Promise<ImportContact[]> {
    const codeMaps = await this.getCodeMaps();
    const contacts: ImportContact[] = [];

    rows.forEach((row) => {
      if (!this.looksLikeGivingSgDataRow(row)) {
        return;
      }

      const remarks = this.pickFirstNonEmpty([
        this.cleanCell(row[24]),
        this.cleanCell(row[25]),
        this.cleanCell(row[26]),
        this.cleanCell(row[27])
      ]);

      const contact = this.createGivingSgContact(
        {
          donationDate: this.cleanCell(row[0]),
          donationReference: this.cleanCell(row[1]),
          campaignName: this.cleanCell(row[3]),
          disbursementDate: this.cleanCell(row[5]),
          donationAmount: this.cleanCell(row[6]),
          paymentMethod: this.cleanCell(row[7]),
          accountEmail: this.cleanCell(row[10]),
          salutation: this.cleanCell(row[11]),
          donorName: this.cleanCell(row[12]),
          preferredDisplayName: this.cleanCell(row[13]),
          externalIdentifierRaw: this.cleanCell(row[14]),
          postalCode: this.cleanCell(row[15]),
          donationType: this.cleanCell(row[21]),
          transactionStatus: this.cleanCell(row[22]),
          remarks,
          taxDeduction: this.cleanCell(row[9]),
          npoName: this.cleanCell(row[2]),
          campaignType: this.cleanCell(row[28]),
          address1: '',
          address2: '',
          block: this.cleanCell(row[16]),
          street: this.cleanCell(row[17]),
          buildingName: this.cleanCell(row[18]),
          floor: this.cleanCell(row[19]),
          unitNumber: this.cleanCell(row[20])
        },
        codeMaps
      );

      if (contact) {
        contacts.push(contact);
      }
    });

    return contacts;
  }

  private static createGivingSgContact(
    values: {
      donationDate: string;
      donationReference: string;
      campaignName: string;
      disbursementDate: string;
      donationAmount: string;
      paymentMethod: string;
      accountEmail: string;
      salutation: string;
      donorName: string;
      preferredDisplayName: string;
      externalIdentifierRaw: string;
      postalCode: string;
      donationType: string;
      transactionStatus: string;
      remarks: string;
      taxDeduction: string;
      npoName: string;
      campaignType: string;
      address1: string;
      address2: string;
      block: string;
      street: string;
      buildingName: string;
      floor: string;
      unitNumber: string;
    },
    codeMaps: DynamicCodeMaps
  ): ImportContact | null {
    const isAnonymous = this.isAnonymousDonor(values.preferredDisplayName, values.donorName);
    const hasRealDonorName = Boolean(values.donorName) && !isAnonymous;
    const hasRealDonorDetails = hasRealDonorName || Boolean(values.accountEmail);
    const applyAnonymousFallback = isAnonymous && !hasRealDonorDetails;
    const externalIdentifier = values.externalIdentifierRaw || (applyAnonymousFallback ? DEFAULT_ANONYMOUS_EXTERNAL_ID : '');
    const inferredContactType = this.inferContactType(externalIdentifier);

    const contact = this.createEmptyContact();
    contact.contact_type = inferredContactType;
    contact.prefix_id = this.mapCode(values.salutation, codeMaps.salutation);
    contact.name = values.donorName || DEFAULT_ANONYMOUS_NAME;
    contact.preferred_name = values.preferredDisplayName;
    contact.external_identifier = externalIdentifier;
    contact.email_primary = values.accountEmail || (applyAnonymousFallback ? DEFAULT_ANONYMOUS_EMAIL : '');
    contact.phone_primary = '';
    contact.street_address = values.address1 || [values.block, values.street, values.buildingName].filter(Boolean).join(' ').trim();
    contact.unit_floor_number = values.address2 || this.buildUnitFloorNumber(values.floor, values.unitNumber);
    contact.postal_code = values.postalCode;

    contact.contribution.financial_type = values.taxDeduction;
    contact.contribution.financial_type_id = this.mapCode(values.taxDeduction, codeMaps.financialType);
    contact.contribution.contribution_status_id = this.mapCode(values.transactionStatus, codeMaps.contributionStatus) ?? 0;
    contact.contribution.total_amount = this.parseAmount(values.donationAmount);
    contact.contribution.source = values.campaignName || values.campaignType || values.npoName;
    contact.contribution['Additional_Contribution_Details.Campaign'] = this.mapCode(values.campaignName, codeMaps.campaign);
    contact.contribution.receive_date = this.normalizeDateForImport(values.donationDate);
    contact.contribution.payment_instrument_id = this.mapCode(values.paymentMethod, codeMaps.paymentMethod);
    contact.contribution.trxn_id = values.donationReference;
    contact.contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] = externalIdentifier || null;
    contact.contribution['Additional_Contribution_Details.Payment_Platform'] = this.mapCode('Giving.sg', codeMaps.platform);
    contact.contribution['Additional_Contribution_Details.Recurring_Donation'] = this.mapCode(values.donationType, codeMaps.frequency);
    contact.contribution['Additional_Contribution_Details.Remarks'] = values.remarks;
    contact.contribution['Additional_Contribution_Details.Imported_Date'] = this.getTodayDate();
    contact.contribution['Additional_Contribution_Details.Received_Date'] = this.normalizeDateForImport(values.disbursementDate);

    if (!contact.contribution.total_amount && !contact.contribution.trxn_id && !contact.name) {
      return null;
    }

    return contact;
  }

  private static async parseGiveAsiaRaw(rows: string[][]): Promise<ImportContact[]> {
    const codeMaps = await this.getCodeMaps();
    const contacts: ImportContact[] = [];

    rows.forEach((row) => {
      if (!this.looksLikeGiveAsiaDataRow(row)) {
        return;
      }

      const receiveDate = this.cleanCell(row[0]);
      const totalAmount = this.cleanCell(row[1]);
      const frequency = this.cleanCell(row[6]);
      const transactionId = this.cleanCell(row[7]);
      const campaignName = this.cleanCell(row[12]);
      const donorName = this.cleanCell(row[15]);
      const email = this.cleanCell(row[16]);
      const mobile = this.cleanCell(row[17]);
      const taxDeduction = this.pickGiveAsiaTaxDeduction(row);
      const externalIdentifier = this.pickGiveAsiaExternalIdentifier(row);
      const rawAddress = this.pickFirstNonEmpty([
        [this.cleanCell(row[23]), this.cleanCell(row[24])].filter(Boolean).join(' '),
        this.cleanCell(row[23]),
        this.cleanCell(row[24])
      ]);
      const remarks = this.pickGiveAsiaRemarks(row, taxDeduction, externalIdentifier);

      const addressParts = this.extractAddressParts(rawAddress);
      const contact = this.createEmptyContact();

      contact.contact_type = this.inferContactType(externalIdentifier);
      contact.prefix_id = null;
      contact.name = donorName || DEFAULT_ANONYMOUS_NAME;
      contact.preferred_name = '';
      contact.external_identifier = externalIdentifier;
      contact.email_primary = email;
      contact.phone_primary = mobile;
      contact.street_address = addressParts.streetAddress;
      contact.unit_floor_number = addressParts.unitFloorNumber;
      contact.postal_code = addressParts.postalCode;

      contact.contribution.financial_type = taxDeduction;
      contact.contribution.financial_type_id = this.mapCode(taxDeduction, codeMaps.financialType);
      contact.contribution.contribution_status_id = 1;
      contact.contribution.total_amount = this.parseAmount(totalAmount);
      contact.contribution.source = campaignName;
      contact.contribution['Additional_Contribution_Details.Campaign'] = this.mapCode(campaignName, codeMaps.campaign);
      contact.contribution.receive_date = this.normalizeDateForImport(receiveDate);
      contact.contribution.payment_instrument_id = this.mapCode('GiveAsia', codeMaps.paymentMethod);
      contact.contribution.trxn_id = transactionId;
      contact.contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] = externalIdentifier || null;
      contact.contribution['Additional_Contribution_Details.Payment_Platform'] = this.mapCode('GiveAsia', codeMaps.platform);
      contact.contribution['Additional_Contribution_Details.Recurring_Donation'] = this.mapCode(frequency, codeMaps.frequency);
      contact.contribution['Additional_Contribution_Details.Remarks'] = remarks;
      contact.contribution['Additional_Contribution_Details.Imported_Date'] = this.getTodayDate();
      contact.contribution['Additional_Contribution_Details.Received_Date'] = '';

      if (!contact.contribution.total_amount && !contact.contribution.trxn_id && !contact.name) {
        return;
      }

      contacts.push(contact);
    });

    return contacts;
  }

  private static async parseBenevityRaw(rows: string[][]): Promise<ImportContact[]> {
    const codeMaps = await this.getCodeMaps();
    const contacts: ImportContact[] = [];

    rows.forEach((row) => {
      if (!this.looksLikeBenevityDataRow(row)) {
        return;
      }

      const firstName = this.cleanCell(row[3]);
      const lastName = this.cleanCell(row[4]);
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const receiveDate = this.normalizeDateForImport(this.cleanCell(row[2]));
      const totalAmount = this.parseBenevityTotalAmount(row[18], row[19], row[14]);
      const transactionId = this.cleanCell(row[12]);
      const frequency = this.cleanCell(row[13]);
      const remarks = this.cleanCell(row[11]);

      const contact = this.createEmptyContact();
      contact.contact_type = 'Individual';
      contact.prefix_id = null;
      contact.name = fullName || DEFAULT_ANONYMOUS_NAME;
      contact.preferred_name = '';
      contact.external_identifier = '';
      contact.email_primary = this.cleanCell(row[5]);
      contact.phone_primary = '';
      contact.street_address = this.cleanCell(row[6]);
      contact.unit_floor_number = '';
      contact.postal_code = this.cleanCell(row[9]);

      contact.contribution.financial_type = 'Non Tax Deductible Donation';
      contact.contribution.financial_type_id = this.mapCode('Non Tax Deductible Donation', codeMaps.financialType);
      contact.contribution.contribution_status_id = this.mapCode('Completed', codeMaps.contributionStatus) ?? 1;
      contact.contribution.total_amount = totalAmount;
      contact.contribution.source = '';
      contact.contribution['Additional_Contribution_Details.Campaign'] = null;
      contact.contribution.receive_date = receiveDate;
      contact.contribution.payment_instrument_id = this.mapCode('Benevity', codeMaps.paymentMethod);
      contact.contribution.trxn_id = transactionId;
      contact.contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] = null;
      contact.contribution['Additional_Contribution_Details.Payment_Platform'] = this.mapCode('Benevity', codeMaps.platform);
      contact.contribution['Additional_Contribution_Details.Recurring_Donation'] = this.mapCode(frequency, codeMaps.frequency);
      contact.contribution['Additional_Contribution_Details.Remarks'] = remarks;
      contact.contribution['Additional_Contribution_Details.Imported_Date'] = this.getTodayDate();
      contact.contribution['Additional_Contribution_Details.Received_Date'] = '';

      if (!contact.contribution.total_amount && !contact.contribution.trxn_id && !contact.name) {
        return;
      }

      contacts.push(contact);
    });

    return contacts;
  }

  private static async parseAdhocRaw(rows: string[][]): Promise<ImportContact[]> {
    const codeMaps = await this.getCodeMaps();
    const contacts: ImportContact[] = [];

    rows.forEach((row) => {
      if (!this.looksLikeAdhocDataRow(row)) {
        return;
      }

      const donorName = this.cleanCell(row[1]);
      const accountEmail = this.cleanCell(row[5]);
      const externalIdentifierRaw = this.cleanCell(row[0]);
      const isAnonymous = this.isAnonymousDonor('', donorName);
      const hasRealDonorName = Boolean(donorName) && !isAnonymous;
      const hasRealDonorDetails = hasRealDonorName || Boolean(accountEmail);
      const applyAnonymousFallback = isAnonymous && !hasRealDonorDetails;
      const externalIdentifier = externalIdentifierRaw || (applyAnonymousFallback ? DEFAULT_ANONYMOUS_EXTERNAL_ID : '');

      const contact = this.createEmptyContact();
      contact.contact_type = this.inferContactType(externalIdentifier);
      contact.prefix_id = null;
      contact.name = donorName || DEFAULT_ANONYMOUS_NAME;
      contact.preferred_name = '';
      contact.external_identifier = externalIdentifier;
      contact.email_primary = accountEmail || (applyAnonymousFallback ? DEFAULT_ANONYMOUS_EMAIL : '');
      contact.phone_primary = this.cleanCell(row[6]);
      contact.street_address = this.cleanCell(row[2]);
      contact.unit_floor_number = this.cleanCell(row[3]);
      contact.postal_code = this.cleanCell(row[4]);

      const financialType = this.cleanCell(row[8]);
      const donationSource = this.cleanCell(row[17]);
      const campaignName = this.cleanCell(row[15]);

      contact.contribution.financial_type = financialType;
      contact.contribution.financial_type_id = this.mapCode(financialType, codeMaps.financialType);
      contact.contribution.contribution_status_id = this.mapCode(this.cleanCell(row[18]), codeMaps.contributionStatus) ?? 0;
      contact.contribution.total_amount = this.parseAmount(this.cleanCell(row[11]));
      contact.contribution.source = donationSource;
      contact.contribution['Additional_Contribution_Details.Campaign'] = this.mapCode(campaignName, codeMaps.campaign);
      contact.contribution.receive_date = this.normalizeDateForImport(this.cleanCell(row[12]));
      contact.contribution.payment_instrument_id = this.mapCode(this.cleanCell(row[13]), codeMaps.paymentMethod);
      contact.contribution.trxn_id = this.cleanCell(row[7]);
      contact.contribution.check_number = this.cleanCell(row[14]);
      contact.contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] = externalIdentifier || null;
      contact.contribution['Additional_Contribution_Details.Payment_Platform'] = this.mapCode(donationSource || 'Adhoc', codeMaps.platform);
      contact.contribution['Additional_Contribution_Details.Recurring_Donation'] = this.mapCode('ONE-TIME', codeMaps.frequency);
      contact.contribution['Additional_Contribution_Details.Remarks'] = this.cleanCell(row[16]);
      contact.contribution['Additional_Contribution_Details.Imported_Date'] = this.getTodayDate();
      contact.contribution['Additional_Contribution_Details.Received_Date'] = '';

      if (!contact.contribution.total_amount && !contact.contribution.trxn_id && !contact.name) {
        return;
      }

      contacts.push(contact);
    });

    return contacts;
  }

  private static pickGiveAsiaTaxDeduction(row: string[]): string {
    const candidates = [row[21], row[20], row[19], row[18]];
    return this.pickFirstNonEmpty(candidates.filter((value) => this.isTaxDeductionValue(this.cleanCell(value))));
  }

  private static pickGiveAsiaExternalIdentifier(row: string[]): string {
    const candidates = [row[22], row[21], row[23], row[24], row[20]];
    return this.pickFirstNonEmpty(candidates.filter((value) => this.isLikelyExternalIdentifier(this.cleanCell(value))));
  }

  private static pickGiveAsiaRemarks(row: string[], taxDeduction: string, externalIdentifier: string): string {
    const trailingRemark = this.cleanCell(row[25]);
    if (trailingRemark) {
      return trailingRemark;
    }

    const inlineRemarks = [this.cleanCell(row[19]), this.cleanCell(row[20])].filter(
      (value) => value && value !== taxDeduction && value !== externalIdentifier && !this.isTaxDeductionValue(value)
    );

    return inlineRemarks.join(' ').trim();
  }

  private static parseBenevityTotalAmount(rawAmount: string | undefined, rawMatchedAmount: string | undefined, rawCurrency: string | undefined): number {
    const amount = this.parseAmount(this.cleanCell(rawAmount));
    const matchedAmount = this.parseAmount(this.cleanCell(rawMatchedAmount));
    const currency = this.normalizeLookupValue(this.cleanCell(rawCurrency));

    let total = amount + matchedAmount;
    if (currency === 'USD') {
      total = total * BENEVITY_USD_TO_SGD_RATE;
    }

    return Math.round(total * 100) / 100;
  }

  private static isTaxDeductionValue(value: string): boolean {
    const normalized = this.normalizeLookupValue(value);
    return ['YES', 'NO', 'TDR', 'NTDR', 'YES NOT ELIGIBLE', 'TAX DEDUCTIBLE DONATION', 'NON TAX DEDUCTIBLE DONATION'].includes(normalized);
  }

  private static isLikelyExternalIdentifier(value: string): boolean {
    const normalized = this.cleanCell(value).toUpperCase();
    if (!normalized) {
      return false;
    }

    const looksLikeNricFin = /^[STFGM]\d{7}[A-Z]$/.test(normalized);
    const looksLikeUen = /^\d{8,9}[A-Z]$/.test(normalized) || /^[A-Z]\d{9}[A-Z]$/.test(normalized);
    return looksLikeNricFin || looksLikeUen;
  }

  private static pickFirstNonEmpty(values: Array<string | undefined>): string {
    for (const value of values) {
      const cleaned = this.cleanCell(value);
      if (cleaned) {
        return cleaned;
      }
    }

    return '';
  }

  private static async getCodeMaps(): Promise<DynamicCodeMaps> {
    if (!this.codeMapsPromise) {
      this.codeMapsPromise = this.loadCodeMaps();
    }

    return this.codeMapsPromise;
  }

  private static async loadCodeMaps(): Promise<DynamicCodeMaps> {
    const defaults = this.getDefaultCodeMaps();

    const [salutation, financialType, contributionStatus, paymentMethod] = await Promise.all([
      this.getOptionGroupCodeMap(['individual_prefix'], defaults.salutation),
      this.getOptionGroupCodeMap(['financial_type'], defaults.financialType),
      this.getOptionGroupCodeMap(['contribution_status'], defaults.contributionStatus),
      this.getOptionGroupCodeMap(['payment_instrument'], defaults.paymentMethod)
    ]);

    let additionalContributionFields: APICustomField[] = [];
    try {
      additionalContributionFields = await Proxy.CustomField.getFieldsBySetName('Additional_Contribution_Details');
    } catch (error) {
      console.warn('Unable to load Additional_Contribution_Details field options. Falling back to default local mappings.', error);
    }

    return {
      salutation,
      frequency: this.getCustomFieldCodeMap(
        additionalContributionFields,
        ['Recurring_Donation', 'Recurring Donation'],
        defaults.frequency
      ),
      campaign: this.getCustomFieldCodeMap(additionalContributionFields, ['Campaign'], defaults.campaign),
      platform: this.getCustomFieldCodeMap(
        additionalContributionFields,
        ['Payment_Platform', 'Payment Platform'],
        defaults.platform
      ),
      financialType,
      contributionStatus,
      paymentMethod
    };
  }

  private static getDefaultCodeMaps(): DynamicCodeMaps {
    return {
      salutation: { ...SALUTATION_CODE_MAP },
      frequency: { ...FREQUENCY_CODE_MAP },
      campaign: { ...CAMPAIGN_CODE_MAP },
      platform: { ...PLATFORM_CODE_MAP },
      financialType: { ...FINANCIAL_TYPE_CODE_MAP },
      contributionStatus: { ...CONTRIBUTION_STATUS_CODE_MAP },
      paymentMethod: { ...PAYMENT_METHOD_CODE_MAP }
    };
  }

  private static async getOptionGroupCodeMap(
    optionGroupNames: string[],
    fallbackMap: Record<string, number>
  ): Promise<Record<string, number>> {
    for (const optionGroupName of optionGroupNames) {
      try {
        const options = await Proxy.CustomField.getOptionValuesByGroupName(optionGroupName);
        const dynamicMap = this.buildCodeMapFromOptions(options);

        if (Object.keys(dynamicMap).length > 0) {
          return this.mergeCodeMaps(fallbackMap, dynamicMap);
        }
      } catch (error) {
        console.warn(`Unable to load option group "${optionGroupName}".`, error);
      }
    }

    return { ...fallbackMap };
  }

  private static getCustomFieldCodeMap(
    fields: APICustomField[],
    aliases: string[],
    fallbackMap: Record<string, number>
  ): Record<string, number> {
    const field = this.getMatchingCustomField(fields, aliases);
    if (!field || !Array.isArray(field.options) || field.options.length === 0) {
      return { ...fallbackMap };
    }

    const dynamicMap = this.buildCodeMapFromOptions(field.options);
    if (Object.keys(dynamicMap).length === 0) {
      return { ...fallbackMap };
    }

    return this.mergeCodeMaps(fallbackMap, dynamicMap);
  }

  private static getMatchingCustomField(fields: APICustomField[], aliases: string[]): APICustomField | undefined {
    const normalizedAliases = aliases.map((alias) => this.normalizeLookupValue(alias));

    return fields.find((field) => {
      const normalizedName = this.normalizeLookupValue(field.name);
      const normalizedLabel = this.normalizeLookupValue(field.label);

      return normalizedAliases.some(
        (alias) => normalizedName === alias || normalizedLabel === alias || normalizedName.includes(alias) || normalizedLabel.includes(alias)
      );
    });
  }

  private static buildCodeMapFromOptions(options: APIOptionValue[]): Record<string, number> {
    const dynamicMap: Record<string, number> = {};

    options.forEach((option) => {
      const numericValue = Number(option.value);
      if (Number.isNaN(numericValue)) {
        return;
      }

      const labelKey = this.normalizeLookupValue(option.label ?? '');
      const nameKey = this.normalizeLookupValue(option.name ?? '');

      if (labelKey) {
        dynamicMap[labelKey] = numericValue;
      }

      if (nameKey) {
        dynamicMap[nameKey] = numericValue;
      }
    });

    return dynamicMap;
  }

  private static mergeCodeMaps(
    fallbackMap: Record<string, number>,
    dynamicMap: Record<string, number>
  ): Record<string, number> {
    return {
      ...fallbackMap,
      ...dynamicMap
    };
  }

  private static createEmptyContact(): ImportContact {
    return {
      contact_type: '',
      prefix_id: null,
      name: '',
      preferred_name: '',
      external_identifier: '',
      email_primary: '',
      phone_primary: '',
      street_address: '',
      unit_floor_number: '',
      postal_code: '',
      contribution: {
        financial_type: '',
        financial_type_id: null,
        contribution_status_id: 0,
        total_amount: 0,
        source: '',
        receive_date: '',
        payment_instrument_id: null,
        trxn_id: '',
        check_number: '',
        'Additional_Contribution_Details.NRIC_FIN_UEN': null,
        'Additional_Contribution_Details.Campaign': null,
        'Additional_Contribution_Details.Payment_Platform': null,
        'Additional_Contribution_Details.Recurring_Donation': null,
        'Additional_Contribution_Details.Remarks': '',
        'Additional_Contribution_Details.Imported_Date': '',
        'Additional_Contribution_Details.Received_Date': '',
        'Donation_In_Kind_Additional_Details.Items_donated': '',
        'Donation_In_Kind_Additional_Details.Quantity': null
      }
    };
  }

  private static normalizeRecord(row: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = this.normalizeHeader(header);
      if (!normalizedHeader) {
        return;
      }

      normalized[normalizedHeader] = this.cleanCell(value);
    });

    return normalized;
  }

  private static normalizeRowByHeaders(row: string[], normalizedHeaders: string[]): Record<string, string> {
    const normalized: Record<string, string> = {};

    normalizedHeaders.forEach((header, index) => {
      if (!header || header in normalized) {
        return;
      }

      normalized[header] = this.cleanCell(row[index]);
    });

    return normalized;
  }

  private static pickValue(normalizedRow: Record<string, string>, aliases: string[]): string {
    for (const alias of aliases) {
      const normalizedAlias = this.normalizeHeader(alias);
      const value = normalizedRow[normalizedAlias];
      if (value) {
        return value;
      }
    }

    return '';
  }

  private static cleanCell(value: string | undefined): string {
    return (value ?? '').trim();
  }

  private static normalizeHeader(value: string): string {
    return value
      .replace(/\uFEFF/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\r\n]/g, ' ')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  }

  private static normalizeLookupValue(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^A-Z0-9 ]/g, '')
      .trim();
  }

  private static isDayMonthYearDate(value: string): boolean {
    return /^\d{2}\/\d{2}\/(?:\d{2}|\d{4})$/.test(this.cleanCell(value));
  }

  private static expandTwoDigitYear(value: string): number {
    const year = Number(value);
    if (Number.isNaN(year)) {
      return 0;
    }

    return year >= 70 ? 1900 + year : 2000 + year;
  }

  private static mapCode(rawValue: string, map: Record<string, number>): number | null {
    const trimmedValue = this.cleanCell(rawValue);
    if (!trimmedValue) {
      return null;
    }

    const numericValue = Number(trimmedValue);
    if (!Number.isNaN(numericValue)) {
      return numericValue;
    }

    const excelCodeValue = this.extractExcelCode(trimmedValue);
    if (excelCodeValue !== null) {
      return excelCodeValue;
    }

    const mappedValue = map[this.normalizeLookupValue(trimmedValue)];
    return mappedValue ?? null;
  }

  private static extractExcelCode(value: string): number | null {
    const match = /^(\d{1,2})\/0?1\/1900$/i.exec(value.trim());
    if (!match) {
      return null;
    }

    const code = Number(match[1]);
    return Number.isNaN(code) ? null : code;
  }

  private static parseAmount(value: string): number {
    const trimmedValue = this.cleanCell(value);
    if (!trimmedValue) {
      return 0;
    }

    const normalized = trimmedValue.replace(/,/g, '');
    const parsedAmount = Number(normalized);
    return Number.isNaN(parsedAmount) ? 0 : parsedAmount;
  }

  private static buildUnitFloorNumber(floor: string, unitNumber: string): string {
    const cleanFloor = this.cleanCell(floor).replace(/^#/, '');
    const cleanUnit = this.cleanCell(unitNumber).replace(/^[-#]/, '');

    if (!cleanFloor && !cleanUnit) {
      return '';
    }

    if (cleanFloor && cleanUnit) {
      return `#${cleanFloor}-${cleanUnit}`;
    }

    if (cleanFloor) {
      return `#${cleanFloor}`;
    }

    return cleanUnit.startsWith('#') ? cleanUnit : `#${cleanUnit}`;
  }

  private static inferContactType(externalIdentifier: string): string {
    const value = this.cleanCell(externalIdentifier).toUpperCase();

    if (!value) {
      return 'Individual';
    }

    const looksLikeNricFin = /^[STFGM]\d{7}[A-Z]$/.test(value);
    if (looksLikeNricFin) {
      return 'Individual';
    }

    const looksLikeUen = /^\d{8,9}[A-Z]$/.test(value) || /^[A-Z]\d{9}[A-Z]$/.test(value);
    if (looksLikeUen) {
      return 'Organization';
    }

    return 'Individual';
  }

  private static isAnonymousDonor(preferredDisplayName: string, donorName: string): boolean {
    const preferredValue = this.normalizeLookupValue(preferredDisplayName);
    const donorValue = this.normalizeLookupValue(donorName);

    return preferredValue.includes('ANONYMOUS') || donorValue.includes('ANONYMOUS');
  }

  private static normalizeDateForImport(value: string): string {
    const trimmedValue = this.cleanCell(value);
    if (!trimmedValue) {
      return '';
    }

    const standardDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?$/i.exec(trimmedValue);
    if (standardDateMatch) {
      return trimmedValue.replace(/\s+/g, ' ').trim();
    }

    const shortYearDateMatch = /^(\d{2})\/(\d{2})\/(\d{2})(?:\s+(\d{1,2}:\d{2}\s*(?:AM|PM)))?$/i.exec(trimmedValue);
    if (shortYearDateMatch) {
      const [, day, month, yearText, timeText] = shortYearDateMatch;
      const expandedYear = this.expandTwoDigitYear(yearText);
      if (!expandedYear) {
        return trimmedValue;
      }

      const normalizedTime = timeText ? timeText.replace(/\s+/g, ' ').trim().toUpperCase() : '';
      return normalizedTime ? `${day}/${month}/${expandedYear} ${normalizedTime}` : `${day}/${month}/${expandedYear}`;
    }

    const isoDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(trimmedValue);
    if (isoDateTimeMatch) {
      const [, year, month, day, hourText, minute] = isoDateTimeMatch;
      const hour = Number(hourText);
      const period = hour >= 12 ? 'PM' : 'AM';
      const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
      return `${day}/${month}/${year} ${String(twelveHour).padStart(2, '0')}:${minute} ${period}`;
    }

    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      return `${day}/${month}/${year}`;
    }

    return trimmedValue;
  }

  private static getTodayDate(): string {
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private static extractAddressParts(address: string): {
    streetAddress: string;
    unitFloorNumber: string;
    postalCode: string;
  } {
    const trimmedAddress = this.cleanCell(address);
    if (!trimmedAddress) {
      return {
        streetAddress: '',
        unitFloorNumber: '',
        postalCode: ''
      };
    }

    const unitMatch = trimmedAddress.match(/#\d{1,3}-\d{1,4}/i);
    const postalMatch = trimmedAddress.match(/\b(\d{6})\b(?!.*\d)/);

    let streetAddress = trimmedAddress;
    if (unitMatch) {
      streetAddress = streetAddress.replace(unitMatch[0], ' ');
    }
    if (postalMatch) {
      streetAddress = streetAddress.replace(postalMatch[1], ' ');
    }

    streetAddress = streetAddress
      .replace(/\bSingapore\b/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      streetAddress,
      unitFloorNumber: unitMatch?.[0] ?? '',
      postalCode: postalMatch?.[1] ?? ''
    };
  }
}
