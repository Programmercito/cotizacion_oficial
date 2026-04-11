import { test } from '@playwright/test';

test('extraer tipos de cambio bcb', async ({ page }) => {
  await page.goto('https://www.bcb.gob.bo/');

  // Esperar a que el contenedor de los indicadores esté presente
  const row = page.locator('.bcb-kpi2-row');
  await row.waitFor();

  // Obtener los artículos (cards)
  const cards = row.locator('article.bcb-kpi2-card');

  // Primer card: Oficial
  const oficialCard = cards.nth(0);
  const oficialCompra = await oficialCard.locator('.bcb-row').nth(0).locator('.bcb-val').innerText();
  const oficialVenta = await oficialCard.locator('.bcb-row').nth(1).locator('.bcb-val').innerText();

  // Segundo card: Referencial
  const referencialCard = cards.nth(1);
  const referencialCompra = await referencialCard.locator('.bcb-row').nth(0).locator('.bcb-val').innerText();
  const referencialVenta = await referencialCard.locator('.bcb-row').nth(1).locator('.bcb-val').innerText();

  console.log('--- Tipo de Cambio Oficial ---');
  console.log(`Compra: ${oficialCompra.trim()}`);
  console.log(`Venta: ${oficialVenta.trim()}`);
  
  console.log('\n--- Tipo de Cambio Referencial ---');
  console.log(`Compra: ${referencialCompra.trim()}`);
  console.log(`Venta: ${referencialVenta.trim()}`);
});
