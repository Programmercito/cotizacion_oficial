import { test } from '@playwright/test';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';

dotenv.config();

function parseSpanishDate(dateStr: string): string {
  const monthMap: Record<string, string> = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12',
  };
  try {
    const regex = /(\d{1,2})\s+DE\s+([A-Z]+),?\s+(\d{4})/i;
    const match = dateStr.match(regex);
    if (match) {
      const day = match[1].padStart(2, '0');
      const monthLabel = match[2].toUpperCase();
      const year = match[3];
      const month = monthMap[monthLabel] || '00';
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.error('Error parsing date:', dateStr);
  }
  return dateStr;
}

function cleanNumeric(val: string): number {
  // Remove thousands separators (commas) and keep decimal dots
  return parseFloat(val.replace(/,/g, '').replace(/[^-0-9.]/g, ''));
}

test('extraer metales y otras cotizaciones bcb y guardar en sqlite', async ({ page }) => {
  const dbPath = process.env.base;
  if (!dbPath) {
    throw new Error('La variable environment "base" no está definida en el .env');
  }

  const db = new Database(dbPath);

  await page.goto('https://www.bcb.gob.bo/librerias/indicadores/otras/ultimo.php');

  // Extract date from page header
  const bodyText = await page.locator('body').innerText();
  const dateMatch = bodyText.match(/FECHA DE LA COTIZACION[:\s]+(\d{1,2}\s+de\s+\S+\s+\d{4})/i);
  let dbDate = new Date().toISOString().split('T')[0];
  if (dateMatch) {
    dbDate = parseSpanishDate(dateMatch[1].trim().toUpperCase());
  }
  console.log(`Fecha de cotización: ${dbDate}`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO cotizaciones (moneda, cotizacion, datetime, exchange, purchase)
    VALUES (?, ?, ?, ?, ?)
  `);

  const rows = page.locator('table tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const cells = row.locator('td');
    const cellCount = await cells.count();
    if (cellCount === 0) continue;

    const cellTexts = await cells.allInnerTexts();
    const rowTextUpper = cellTexts.join('|').toUpperCase().replace(/\s+/g, ' ');

    // --- EURO ---
    // Row: | UNION EUROPEA | EURO | EUR | 8.09134 | 0.84782 |
    // Value we want: Bs per EUR (column index 3)
    if (rowTextUpper.includes('EURO') && rowTextUpper.includes('EUR') && cellCount >= 4) {
      const valueStr = cellTexts[3]?.trim();
      if (valueStr) {
        const value = cleanNumeric(valueStr);
        if (!isNaN(value) && value > 0) {
          console.log(`Guardando: moneda=eur, datetime=${dbDate}, cotizacion=${value}, purchase=${value}`);
          insert.run('eur', value, dbDate, 'bcb', value);
        }
      }
    }

    // --- UFV ---
    // Row: |   | UNIDAD DE FOMENTO DE VIVIENDA | Bs/UFV |   | 3.21125 |
    // Value we want: last numeric cell
    if (rowTextUpper.includes('UFV')) {
      const lastNumericVal = [...cellTexts]
        .reverse()
        .map((t) => cleanNumeric(t.trim()))
        .find((n) => !isNaN(n) && n > 0);
      if (lastNumericVal !== undefined) {
        console.log(`Guardando: moneda=ufv, datetime=${dbDate}, cotizacion=${lastNumericVal}, purchase=${lastNumericVal}`);
        insert.run('ufv', lastNumericVal, dbDate, 'bcb', lastNumericVal);
      }
    }

    // --- ORO ---
    // Row: | ORO | ONZA TROY | ORO | USD./O.T.F. | 4,866.45000 |
    if (rowTextUpper.includes('ORO') && (rowTextUpper.includes('ONZA') || rowTextUpper.includes('TROY'))) {
      const lastNumericVal = [...cellTexts]
        .reverse()
        .map((t) => cleanNumeric(t.trim()))
        .find((n) => !isNaN(n) && n > 0);
      if (lastNumericVal !== undefined) {
        console.log(`Guardando: moneda=oro, datetime=${dbDate}, cotizacion=${lastNumericVal}, purchase=${lastNumericVal}`);
        insert.run('oro', lastNumericVal, dbDate, 'bcb', lastNumericVal);
      }
    }

    // --- PLATA ---
    // Row: | PLATA | ONZA TROY | PLATA | USD./O.T.F. | 82.19370 |
    if (rowTextUpper.includes('PLATA') && (rowTextUpper.includes('ONZA') || rowTextUpper.includes('TROY'))) {
      const lastNumericVal = [...cellTexts]
        .reverse()
        .map((t) => cleanNumeric(t.trim()))
        .find((n) => !isNaN(n) && n > 0);
      if (lastNumericVal !== undefined) {
        console.log(`Guardando: moneda=plata, datetime=${dbDate}, cotizacion=${lastNumericVal}, purchase=${lastNumericVal}`);
        insert.run('plata', lastNumericVal, dbDate, 'bcb', lastNumericVal);
      }
    }
  }

  db.close();
});
