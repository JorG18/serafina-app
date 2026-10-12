// node test.js [fixture.json]  — fixture = valores crudos de la planilla, como los devuelve el Apps Script.
const assert = require('assert');
const { fromSheet, toSheet, T, costo, comision } = require('./datos.js');
const sheet = require(require('path').resolve(process.argv[2] || 'fixture.json'));
globalThis.db = fromSheet(sheet);
const p = (n) => db.productos.find((x) => x.nombre === n);

assert.strictEqual(db.insumos.length, sheet[T.ins].slice(2).filter((r) => r[0]).length);
assert.strictEqual(db.ajustes.hora, 10000);
assert.strictEqual(db.ajustes.comision, 6.4);
assert.deepStrictEqual(db.ajustes.mayorista, [{ desde: 6, pct: 20 }, { desde: 12, pct: 25 }, { desde: 24, pct: 30 }]);
assert.strictEqual(db.ajustes.transferencia, 10);
// costo por vela igual a la columna auxiliar de la planilla
for (const r of sheet[T.vel].slice(2)) if (r[1] === 'Vela' && typeof r[12] === 'number' && !costo(p(r[0])).faltan.length)
  assert(Math.abs(costo(p(r[0])).valor - r[12]) < 0.01, r[0]);
assert.deepStrictEqual(costo(p('Fuego Sagrado')).faltan, ['Copa de cristal', 'Ojo de tigre']);
assert.strictEqual(p('Kit Spa').velas.length, 3);
// "te queda después de comisiones" igual a la planilla (incluye cuotas)
for (const r of sheet[T.vel].slice(2)) if (r[4]) assert(Math.abs(r[4] - comision(r[4], 'tarjeta') - r[7]) < 0.01, r[0]);
assert.strictEqual(comision(30000, 'transfer'), 0);

// ida y vuelta: escribir y volver a leer da lo mismo
const w = Object.fromEntries(toSheet(db).map((x) => [x.tab, x]));
const back = {};
for (const [tab, x] of Object.entries(w)) back[tab] = x.start === 'A3' ? [[], [], ...x.rows] : x.rows;
db.cotizaciones = [{ num: 1, fecha: '2026-10-12T15:00:00.000Z', cliente: 'Prueba', doc: '20123456789', pago: 'tarjeta', estado: 'vendida', total: 1000, ganancia: 500, items: [] }];
back[T.cot] = Object.fromEntries(toSheet(db).map((x) => [x.tab, x]))[T.cot].rows;
const db2 = fromSheet(back);
assert.deepStrictEqual(db2.insumos.map((i) => [i.nombre, i.cantidad, i.pague]), db.insumos.map((i) => [i.nombre, i.cantidad, i.pague]));
assert.deepStrictEqual(db2.productos, db.productos);
assert.deepStrictEqual(db2.ajustes, db.ajustes);
assert.deepStrictEqual(db2.cotizaciones, db.cotizaciones);
console.log('ok:', db.insumos.length, 'insumos,', db.productos.length, 'productos');
