import Papa from 'papaparse';
import { ImportContact } from '../../../proxy/contact/import/types';
import { ContactValidator } from './validation-utils';

export type UploadCSVFormat = 'mapped-template' | 'giving-sg-raw' | 'giveasia-raw' | 'unknown';

export interface ParsedUploadCSVResult {
  contacts: ImportContact[];
  format: UploadCSVFormat;
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
  GIVEASIA: 6
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
  CASH: 3,
  CHEQUE: 4,
  CHECK: 4,
  EFT: 5,
  'BANK TRANSFER': 6,
  GIRO: 7,
  GIVEASIA: 8,
  'DONATION IN KIND': 9,
  ENETS: 10,
  GRABPAY: 11
};

export class UploadCsvMapper {
  static parse(csvText: string): ParsedUploadCSVResult {
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
        contacts: this.parseGivingSgRaw(csvText),
        format: detectedFormat
      };
    }

    if (detectedFormat === 'giveasia-raw') {
      return {
        contacts: this.parseGiveAsiaRaw(rows),
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
    const firstRow = rows[0] ?? [];
    const normalizedHeaders = firstRow.map((value) => this.normalizeHeader(value));

    const looksLikeMappedTemplate =
      normalizedHeaders.includes('contact type') &&
      (normalizedHeaders.includes('financial type code') ||
        normalizedHeaders.includes('payment method code') ||
        normalizedHeaders.includes('total amount in sgd'));

    if (looksLikeMappedTemplate) {
      return 'mapped-template';
    }

    const looksLikeGivingSgRaw =
      normalizedHeaders.includes('donation reference') &&
      normalizedHeaders.includes('donation amount') &&
      normalizedHeaders.includes('payment method');

    if (looksLikeGivingSgRaw) {
      return 'giving-sg-raw';
    }

    const looksLikeGiveAsiaRaw = this.looksLikeGiveAsiaDataRow(firstRow);

    if (looksLikeGiveAsiaRaw) {
      return 'giveasia-raw';
    }

    return 'unknown';
  }

  private static looksLikeGiveAsiaDataRow(row: string[]): boolean {
    if (!row || row.length < 12) {
      return false;
    }

    const firstCell = this.cleanCell(row[0]);
    const platformCell = this.cleanCell(row[14] ?? '');

    return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(firstCell) || platformCell.toLowerCase() === 'give.asia';
  }

  private static parseGivingSgRaw(csvText: string): ImportContact[] {
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: 'greedy'
    });

    const contacts: ImportContact[] = [];

    parsed.data.forEach((row) => {
      const normalizedRow = this.normalizeRecord(row);
      if (!Object.values(normalizedRow).some((value) => value !== '')) {
        return;
      }

      const donationDate = this.pickValue(normalizedRow, ['Donation Date', 'Donation Date DD/MM/YYYY']);
      const donationReference = this.pickValue(normalizedRow, ['Donation Reference']);
      const campaignName = this.pickValue(normalizedRow, ['Campaign Name']);
      const disbursementDate = this.pickValue(normalizedRow, ['Disbursement Batch Date', 'Disbursement Batch Date DD/MM/YYYY']);
      const donationAmount = this.pickValue(normalizedRow, ['Donation Amount']);
      const paymentMethod = this.pickValue(normalizedRow, ['Payment Method']);
      const accountEmail = this.pickValue(normalizedRow, ['Account Email']);
      const salutation = this.pickValue(normalizedRow, ['Salutation']);
      const donorName = this.pickValue(normalizedRow, ['Donor Name']);
      const preferredDisplayName = this.pickValue(normalizedRow, ['Preferred Display Name']);
      const externalIdentifierRaw = this.pickValue(normalizedRow, ['Donor NRIC/FIN']);
      const postalCode = this.pickValue(normalizedRow, ['Postal Code']);
      const donationType = this.pickValue(normalizedRow, ['Donation Type']);
      const transactionStatus = this.pickValue(normalizedRow, ['Transaction Status']);
      const remarks = this.pickValue(normalizedRow, ['Remarks']);
      const taxDeduction = this.pickValue(normalizedRow, ['TDR', 'Tax Deduction', 'Tax Deduction/FinancialType']);
      const npoName = this.pickValue(normalizedRow, ['NPO Name']);
      const campaignType = this.pickValue(normalizedRow, ['Campaign Type']);

      const address1 = this.pickValue(normalizedRow, ['Address 1']);
      const address2 = this.pickValue(normalizedRow, ['Address 2']);
      const block = this.pickValue(normalizedRow, ['Block']);
      const street = this.pickValue(normalizedRow, ['Street']);
      const buildingName = this.pickValue(normalizedRow, ['Building Name']);
      const floor = this.pickValue(normalizedRow, ['Floor']);
      const unitNumber = this.pickValue(normalizedRow, ['Unit Number']);

      const isAnonymous = this.isAnonymousDonor(preferredDisplayName, donorName);
      const hasRealDonorDetails = Boolean(donorName || accountEmail);
      const applyAnonymousFallback = isAnonymous && !hasRealDonorDetails;
      const externalIdentifier = externalIdentifierRaw || (applyAnonymousFallback ? DEFAULT_ANONYMOUS_EXTERNAL_ID : '');
      const inferredContactType = this.inferContactType(externalIdentifier);

      const contact = this.createEmptyContact();
      contact.contact_type = inferredContactType;
      contact.prefix_id = this.mapCode(salutation, SALUTATION_CODE_MAP);
      contact.name = donorName || DEFAULT_ANONYMOUS_NAME;
      contact.preferred_name = preferredDisplayName;
      contact.external_identifier = externalIdentifier;
      contact.email_primary = accountEmail || (applyAnonymousFallback ? DEFAULT_ANONYMOUS_EMAIL : '');
      contact.phone_primary = '';
      contact.street_address = address1 || [block, street, buildingName].filter(Boolean).join(' ').trim();
      contact.unit_floor_number = address2 || this.buildUnitFloorNumber(floor, unitNumber);
      contact.postal_code = postalCode;

      contact.contribution.financial_type = taxDeduction;
      contact.contribution.financial_type_id = this.mapCode(taxDeduction, FINANCIAL_TYPE_CODE_MAP);
      contact.contribution.contribution_status_id = this.mapCode(transactionStatus, CONTRIBUTION_STATUS_CODE_MAP) ?? 0;
      contact.contribution.total_amount = this.parseAmount(donationAmount);
      contact.contribution.source = campaignName || campaignType || npoName;
      contact.contribution['Additional_Contribution_Details.Campaign'] = this.mapCode(campaignName, CAMPAIGN_CODE_MAP);
      contact.contribution.receive_date = this.normalizeDateForImport(donationDate);
      contact.contribution.payment_instrument_id = this.mapCode(paymentMethod, PAYMENT_METHOD_CODE_MAP);
      contact.contribution.trxn_id = donationReference;
      contact.contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] = externalIdentifier || null;
      contact.contribution['Additional_Contribution_Details.Payment_Platform'] = this.mapCode('Giving.sg', PLATFORM_CODE_MAP);
      contact.contribution['Additional_Contribution_Details.Recurring_Donation'] = this.mapCode(donationType, FREQUENCY_CODE_MAP);
      contact.contribution['Additional_Contribution_Details.Remarks'] = remarks;
      contact.contribution['Additional_Contribution_Details.Imported_Date'] = this.getTodayDate();
      contact.contribution['Additional_Contribution_Details.Received_Date'] = this.normalizeDateForImport(disbursementDate);

      if (!contact.contribution.total_amount && !contact.contribution.trxn_id && !contact.name) {
        return;
      }

      contacts.push(contact);
    });

    return contacts;
  }

  private static parseGiveAsiaRaw(rows: string[][]): ImportContact[] {
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
      const taxDeduction = this.cleanCell(row[20]);
      const externalIdentifier = this.cleanCell(row[21]);
      const rawAddress = this.cleanCell(row[23]);
      const remarks = this.cleanCell(row[25]) || this.cleanCell(row[19]);

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
      contact.contribution.financial_type_id = this.mapCode(taxDeduction, FINANCIAL_TYPE_CODE_MAP);
      contact.contribution.contribution_status_id = 1;
      contact.contribution.total_amount = this.parseAmount(totalAmount);
      contact.contribution.source = campaignName;
      contact.contribution['Additional_Contribution_Details.Campaign'] = this.mapCode(campaignName, CAMPAIGN_CODE_MAP);
      contact.contribution.receive_date = this.normalizeDateForImport(receiveDate);
      contact.contribution.payment_instrument_id = this.mapCode('GiveAsia', PAYMENT_METHOD_CODE_MAP);
      contact.contribution.trxn_id = transactionId;
      contact.contribution['Additional_Contribution_Details.NRIC_FIN_UEN'] = externalIdentifier || null;
      contact.contribution['Additional_Contribution_Details.Payment_Platform'] = this.mapCode('GiveAsia', PLATFORM_CODE_MAP);
      contact.contribution['Additional_Contribution_Details.Recurring_Donation'] = this.mapCode(frequency, FREQUENCY_CODE_MAP);
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

    const isoDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/.exec(trimmedValue);
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
