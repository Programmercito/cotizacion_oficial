import { test } from '@playwright/test';

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
    // Ejemplo: "SÁBADO 11 DE ABRIL, 2026"
    // Buscamos: día (dígitos), mes (letras), año (4 dígitos)
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
  return dateStr; // Devolver original si falla
}

test('extraer tipos de cambio bcb con fechas formateadas', async ({ page }) => {
  await page.goto('https://www.bcb.gob.bo/');

  const row = page.locator('.bcb-kpi2-row');
  await row.waitFor();

  const cards = row.locator('article.bcb-kpi2-card');
  const count = await cards.count();

  for (let i = 0; i < Math.min(count, 2); i++) {
    const card = cards.nth(i);
    const title = await card.locator('.bcb-kpi2-name').innerText();
    
    const dateElements = card.locator('.bcb-kpi2-asof time');
    const datesCount = await dateElements.count();
    const formattedDates: string[] = [];
    
    for (let j = 0; j < datesCount; j++) {
      const rawDate = await dateElements.nth(j).innerText();
      formattedDates.push(parseSpanishDate(rawDate.trim()));
    }

    console.log(`\n--- ${title.trim()} ---`);
    console.log(`Fechas (SQLite): ${formattedDates.join(' | ')}`);

    const dataRows = card.locator('.bcb-row');
    const rowsCount = await dataRows.count();

    for (let j = 0; j < rowsCount; j++) {
      const label = await dataRows.nth(j).locator('.bcb-lbl').innerText();
      const value = await dataRows.nth(j).locator('.bcb-val').innerText();
      const subLabelElement = dataRows.nth(j).locator('.bcb-row-sub');
      let subLabel = '';
      if (await subLabelElement.count() > 0) {
        subLabel = await subLabelElement.innerText();
      }

      console.log(`${label.trim()}${subLabel ? ` (${subLabel.trim()})` : ''}: ${value.trim()}`);
    }
  }
});
