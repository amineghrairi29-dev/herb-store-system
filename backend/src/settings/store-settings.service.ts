import { Injectable } from '@nestjs/common';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { defaultSettings, settingsInput, type StoreSettings } from './store-settings.values.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';
const columns = 'id, "storeName", phone, "secondaryPhone", email, address, city, country, website, currency, "reportFooter", "createdAt"::text, "updatedAt"::text';
@Injectable()
export class StoreSettingsService {
  read(): Promise<StoreSettings> {
    return withPurchaseTransaction(async tx => (await tx.client.query<StoreSettings>(`SELECT ${columns} FROM public."storeSettings" WHERE id = 1`)).rows[0] ?? { ...defaultSettings }, true);
  }
  update(body: unknown): Promise<StoreSettings> {
    const input = settingsInput(body), keys = Object.keys(input);
    // Identifiers come only from the validated whitelist. Values always remain parameters.
    const names = keys.map(key => `"${key}"`);
    return withPurchaseTransaction(async tx => audited(tx, 'STORE_SETTINGS_UPDATE', 'STORE_SETTINGS', (await tx.client.query<StoreSettings>(`INSERT INTO public."storeSettings" (${names.join(', ')}, "updatedAt") VALUES (${keys.map((_, index) => `$${index + 1}`).join(', ')}, now()) ON CONFLICT (id) DO UPDATE SET ${names.map(name => `${name} = EXCLUDED.${name}`).join(', ')}, "updatedAt" = now() RETURNING ${columns}`, Object.values(input))).rows[0], { changedFields: changedFields(input) }));
  }
}
