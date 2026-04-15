import { test } from '@playwright/test';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

function parseSpanishDate(dateStr: string): string {
  const monthMap: Record<string, string> = {
    'ENERO': '01',
    'FEBRERO': '02',
    'MARZO': '03',
    'ABRIL': '04',
    'MAYO': '05',
    'JUNIO': '06',
    'JULIO': '07',
    'AGOSTO': '08',
    'SEPTIEMBRE': '09',
    'OCTUBRE': '10',
    'NOVIEMBRE': '11',
    'DICIEMBRE': '12'
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
  return parseFloat(val.replace(',', '.').replace(/[^-0-9.]/g, ''));
}

test('extraer tipos de cambio bcb y guardar en sqlite', async ({ page }) => {
  const dbPath = process.env.base;
  if (!dbPath) {
    throw new Error('La variable environment "base" no está definida en el .env');
  }

  const db = new Database(dbPath);

  await page.goto('https://www.bcb.gob.bo/');

  const row = page.locator('.bcb-kpi2-row');
  await row.waitFor();

  const cards = row.locator('article.bcb-kpi2-card');
  const count = await cards.count();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO cotizaciones (moneda, cotizacion, datetime, exchange, purchase)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < Math.min(count, 2); i++) {
    const card = cards.nth(i);
    const rawTitle = await card.locator('.bcb-kpi2-name').innerText();
    const title = rawTitle.toLowerCase();
    
    // Mapeo sugerido: la primera card suele ser el "Oficial" aunque diga solo "Tipo de Cambio"
    let moneda = 'usd oficial'; 
    if (title.includes('referencial')) {
      moneda = 'usd referencial';
    }

    const dateElements = card.locator('.bcb-kpi2-asof time');
    const datesCount = await dateElements.count();

    if (datesCount > 0) {
      const rawDate = await dateElements.first().innerText();
      const dbDate = parseSpanishDate(rawDate.trim());

      const dataRows = card.locator('.bcb-row');
      const rowsCount = await dataRows.count();

      let compra = 0;
      let venta = 0;

      for (let k = 0; k < rowsCount; k++) {
        const labelText = await dataRows.nth(k).locator('.bcb-lbl').innerText();
        const label = labelText.toLowerCase();
        const value = cleanNumeric(await dataRows.nth(k).locator('.bcb-val').innerText());

        if (label.includes('compra')) compra = value;
        if (label.includes('venta')) venta = value;
      }

      console.log(`Guardando registro: moneda=${moneda}, datetime=${dbDate}, exchange=bcb, cotizacion=${venta}, purchase=${compra}`);
      
      insert.run(moneda, venta, dbDate, 'bcb', compra);
    } else {
      const dataRows = card.locator('.bcb-row');
      const rowsCount = await dataRows.count();

      for (let k = 0; k < rowsCount; k++) {
        const row = dataRows.nth(k);
        const rawDate = await row.locator('.bcb-lbl').first().innerText();
        const dbDate = parseSpanishDate(rawDate.trim());

        const values = await row.locator('.bcb-val').allInnerTexts();
        const nums = values.map(cleanNumeric).filter((n) => !Number.isNaN(n));

        if (nums.length >= 2) {
          const compra = nums[0];
          const venta = nums[1];
          console.log(`Guardando registro: moneda=${moneda}, datetime=${dbDate}, exchange=bcb, cotizacion=${venta}, purchase=${compra}`);
          insert.run(moneda, venta, dbDate, 'bcb', compra);
        } else {
          console.warn(`No se pudo parsear fila oficial para ${moneda} en fecha ${dbDate}`);
        }
      }
    }
  }

  db.close();
});
