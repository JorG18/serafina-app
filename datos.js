// Traduce entre las pestañas de la planilla y los datos de la app (db). Sin DOM: se prueba con `node test.js`.
const T = { ins: '1. Insumos', rec: '2. Recetas', vel: '3. Velas y precios', kit: '4. Kits', aju: 'Ajustes', cot: 'Cotizaciones' };

// Ajustes por etiqueta exacta, en el orden de la planilla. pct = la planilla guarda 0,064 y la app 6,4.
const AJUSTES = [
  ['iva', 'IVA', 1], ['comision', 'Comisión de Pago Nube (tarjeta, débito, MODO)', 1],
  ['c2', 'Costo extra por dar 2 cuotas sin interés', 1], ['c3', 'Costo extra por dar 3 cuotas sin interés', 1], ['c6', 'Costo extra por dar 6 cuotas sin interés', 1],
  ['m2', 'Desde qué monto hay 2 cuotas'], ['m3', 'Desde qué monto hay 3 cuotas'], ['m6', 'Desde qué monto hay 6 cuotas'],
  ['gastos', 'Gastos generales (luz, gas, herramientas)', 1], ['hora', 'Cuánto vale una hora de trabajo'], ['objetivo', 'Ganancia mínima que querés por venta', 1],
  // estos los agrega la app debajo de los de la planilla
  ['fisico', 'Descuento venta física', 1], ['transferencia', 'Descuento por transferencia', 1], ['senaDesde', 'Seña del 50% desde (velas sueltas)'],
  ['may0d', 'Mayorista escalón 1: desde (velas)'], ['may0p', 'Mayorista escalón 1: descuento', 1],
  ['may1d', 'Mayorista escalón 2: desde (velas)'], ['may1p', 'Mayorista escalón 2: descuento', 1],
  ['may2d', 'Mayorista escalón 3: desde (velas)'], ['may2p', 'Mayorista escalón 3: descuento', 1],
];
const DEFAULTS = { iva: 21, comision: 6.4, c2: 0, c3: 0, c6: 0, m2: Infinity, m3: Infinity, m6: Infinity, gastos: 10, hora: 8000, objetivo: 35, fisico: 15, transferencia: 10, senaDesde: 24,
  may0d: 6, may0p: 20, may1d: 12, may1p: 25, may2d: 24, may2p: 30 };

const filas = (t) => (t || []).slice(2).filter((r) => r[0] !== '' && r[0] != null);
const num = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.')) || 0);
const fecha = (v) => (!v ? '' : /^\d{4}-/.test(v) ? new Date(v).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' }) : String(v));
const redondo = (v) => Math.round(v * 1e6) / 1e6;

function fromSheet(s) {
  const plano = {};
  for (const r of (s[T.aju] || []).slice(2)) {
    const a = AJUSTES.find(([, label]) => label === String(r[0]).trim());
    if (a && r[1] !== '' && r[1] != null) plano[a[0]] = redondo(num(r[1]) * (a[2] ? 100 : 1));
  }
  const aj = { ...DEFAULTS, ...plano };
  const ajustes = { ...aj, mayorista: [0, 1, 2].map((n) => ({ desde: aj[`may${n}d`], pct: aj[`may${n}p`] })) };
  for (const n of [0, 1, 2]) { delete ajustes[`may${n}d`]; delete ajustes[`may${n}p`]; }

  const insumos = filas(s[T.ins]).map((r, i) => ({ id: 'i' + i, nombre: String(r[0]), unidad: r[1] || 'Unidades', cantidad: num(r[2]), pague: num(r[3]), fecha: fecha(r[4]) }));
  const productos = filas(s[T.vel]).map((r, i) => String(r[1]).trim() === 'Kit'
    ? { id: 'k' + i, tipo: 'kit', nombre: String(r[0]), precio: num(r[4]), velas: [] }
    : { id: 'p' + i, tipo: 'vela', nombre: String(r[0]), porLote: num(r[2]), horas: num(r[3]), precio: num(r[4]), receta: [] });
  const porNombre = (n) => productos.find((p) => p.nombre === n);
  for (const r of filas(s[T.rec])) porNombre(r[0])?.receta?.push({ ins: String(r[1]), cant: num(r[2]) });
  for (const r of filas(s[T.kit])) for (let n = 0; n < num(r[2]); n++) porNombre(r[0])?.velas?.push(String(r[1]));
  const cotizaciones = (s[T.cot] || []).slice(1).map((r) => r.find((x) => String(x).startsWith('{'))).filter(Boolean).map((x) => JSON.parse(x));
  return { ajustes, insumos, productos, cotizaciones };
}

function toSheet(db) {
  const a = { ...db.ajustes };
  db.ajustes.mayorista.forEach((e, n) => { a[`may${n}d`] = e.desde; a[`may${n}p`] = e.pct; });
  const velas = db.productos.filter((p) => p.tipo === 'vela');
  const kits = db.productos.filter((p) => p.tipo === 'kit');
  const contar = (lista) => [...new Set(lista)].map((n) => [n, lista.filter((x) => x === n).length]);
  return [
    { tab: T.ins, clear: 'A3:E', start: 'A3', rows: db.insumos.map((i) => [i.nombre, i.unidad, i.cantidad || '', i.pague || '', i.fecha || '']) },
    { tab: T.rec, clear: 'A3:C', start: 'A3', rows: velas.flatMap((p) => p.receta.map((r) => [p.nombre, r.ins, r.cant])) },
    { tab: T.vel, clear: 'A3:E', start: 'A3', rows: db.productos.map((p) => p.tipo === 'kit' ? [p.nombre, 'Kit', '', '', p.precio] : [p.nombre, 'Vela', p.porLote, p.horas, p.precio]) },
    { tab: T.kit, clear: 'A3:C', start: 'A3', rows: kits.flatMap((k) => contar(k.velas).map(([n, c]) => [k.nombre, n, c])) },
    { tab: T.aju, clear: 'A3:B40', start: 'A3', rows: AJUSTES.map(([k, label, pct]) => [label, Number.isFinite(a[k]) ? redondo(pct ? a[k] / 100 : a[k]) : '']) },
    { tab: T.cot, clear: 'A1:I', start: 'A1', rows: [['N.º', 'Fecha', 'Clienta', 'DNI/CUIT', 'Pago', 'Estado', 'Total', 'Le quedó', 'datos de la app (no tocar)'],
      ...db.cotizaciones.map((c) => [c.num, fecha(c.fecha), c.cliente, c.doc || '', c.pago === 'tarjeta' ? 'Tarjeta' : 'Transferencia', c.estado === 'vendida' ? 'Vendida' : 'Cotización', c.total, Math.round(c.ganancia), JSON.stringify(c)])] },
  ];
}

// ===== Cálculos (la misma lógica de la planilla). Usan el `db` global de la app. =====
const UNIDADES = { Kg: [1000, 'gr'], Gramos: [1, 'gr'], Litros: [1000, 'ml'], Ml: [1, 'ml'], Metros: [100, 'cm'], Cm: [1, 'cm'], Unidades: [1, 'u.'] };
const insumo = (nombre) => db.insumos.find((i) => i.nombre === nombre);
const prodByName = (n) => db.productos.find((p) => p.nombre === n);
function costoUnidad(i) { // cuánto sale 1 gr / 1 ml / 1 cm / 1 unidad
  if (!i || !i.cantidad || !i.pague) return null;
  return i.pague / (i.cantidad * (UNIDADES[i.unidad] || [1])[0]);
}
function costo(p) { // { valor, faltan: [insumos sin precio] }
  if (p.tipo === 'kit') {
    const partes = p.velas.map((n) => prodByName(n) ? costo(prodByName(n)) : { valor: 0, faltan: [n] });
    return { valor: partes.reduce((s, c) => s + c.valor, 0), faltan: [...new Set(partes.flatMap((c) => c.faltan))] };
  }
  let insumos = 0; const faltan = [];
  for (const r of p.receta) {
    const cu = costoUnidad(insumo(r.ins));
    if (cu === null) faltan.push(r.ins); else insumos += cu * r.cant;
  }
  const a = db.ajustes;
  return { valor: p.porLote ? (insumos * (1 + a.gastos / 100) + p.horas * a.hora) / p.porLote : 0, faltan };
}
// Con tarjeta: comisión de Pago Nube + lo que cuestan las cuotas sin interés de ese monto, todo con IVA.
function comision(total, pago) {
  const a = db.ajustes;
  if (pago !== 'tarjeta') return 0;
  const cuotas = total >= a.m6 ? a.c6 : total >= a.m3 ? a.c3 : total >= a.m2 ? a.c2 : 0;
  return total * (a.comision + cuotas) / 100 * (1 + a.iva / 100);
}

if (typeof module !== 'undefined') module.exports = { fromSheet, toSheet, T, costo, comision };
