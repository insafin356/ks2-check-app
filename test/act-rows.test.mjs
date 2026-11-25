import assert from 'node:assert/strict';import fs from 'node:fs';import * as X from '../vendor/xlsx.mjs';import {parseActWorkbook} from '../js/xlsx-act.js';
function parse(rows){const w=X.utils.book_new();X.utils.book_append_sheet(w,X.utils.aoa_to_sheet(rows),'Акт');return parseActWorkbook(X.write(w,{type:'array',bookType:'xlsx'}));}
const header=['№ п/п','Обоснование','Наименование работ и затрат','Единица измерения','Цена за единицу'];
let r=parse([header,[1,'ГЭСН01-01-009-14','Работа','1000 м3',75870.84],[null,'1. 91.01.05-085','Экскаватор','маш.час',2740.86],[null,null,'Средний разряд','чел.-ч',337.74],[2,'24.3.03.11-0015-0001','Трубы','м',8259.15],[3,null,'Без шифра','шт',12],[4,'ГЭСН01-02-057-02','Без цены','100 м3',null]]);
assert.equal(r.rows.length,4);assert.equal(r.rows[1].code,'24.3.03.11-0015-0001');assert.equal(r.rows[2].code,'');assert.equal(r.rows[3].price,null);
r=parse([header.slice(1),['ГЭСН01-01-009-14','Работа','1000 м3',75870.84]]);assert.equal(r.rows.length,1);assert.equal(r.meta.cols.position,null);
r=parse([['Служебная',...header],['x',1,'ГЭСН01-01-009-14','Работа','1000 м3',75870.84],['x',null,'1. 91.01.05-085','Ресурс','маш.час',2740.86]]);assert.equal(r.rows.length,1);assert.equal(r.meta.cols.position,2);
r=parse([
 ['№ п/п','Обоснование','Наименование работ и затрат',null,'Единица измерения',null,null,'Цена за единицу'],
 [1,2,3,null,4,5,6,7,8,9,10],
 [null,'Раздел 1. Земляные работы'],
 [1,'ГЭСН01-01-009-14','Работа',null,'1000 м3',null,null,75870.84],
 [1,2,3,null,4,5,6,7,8,9,10],
 [2,'ГЭСН01-02-057-02','Другая работа',null,'100 м3',null,null,67753.59],
]);
assert.equal(r.rows.length,2);
assert.equal(r.rows[0].position,1);
assert.equal(r.rows[0].srcRow,4);
assert.equal(r.rows[0].code,'ГЭСН01-01-009-14');
assert.equal(r.rows[1].position,2);
assert.equal(r.rows[1].srcRow,6);
r=parse([
 ['№ пп','Обоснование','Наименование работ и затрат','Единица измерения','Цена за единицу'],
 [1,'ГЭСН01-01-009-14','Работа','1000 м3',75870.84],
 [null,'Заказчик: Подпись'],
]);
assert.equal(r.meta.cols.position,1);
assert.equal(r.rows.length,1);
r=parse([
 ['Объект',null,'Ответвление газопровода. Адрес: РТ, п. Опушка'],
 header,
 [1,'ГЭСН01-01-009-14','Работа','1000 м3',75870.84],
]);
assert.equal(r.meta.objectName,'Ответвление газопровода. Адрес: РТ, п. Опушка');
r=parse([
 ['Объект - Ответвление газопровода по адресу: РТ, г. Казань'],
 header,
 [1,'ГЭСН01-01-009-14','Работа','1000 м3',75870.84],
]);
assert.equal(r.meta.objectName,'Ответвление газопровода по адресу: РТ, г. Казань');
if(process.argv[2]){
 const data=fs.readFileSync(process.argv[2]),book=X.read(data),actual=parseActWorkbook(data),ws=book.Sheets[actual.meta.sheet];
 const expected=[];for(let i=30;i<=840;i++){if(Number.isInteger(ws['A'+i]?.v)){expected.push({position:ws['A'+i].v,srcRow:i,code:ws['C'+i]?.v?.split(/\r?\n/)[0],name:String(ws['D'+i]?.v??'').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim(),unit:ws['E'+i]?.v,price:ws['H'+i]?.v});}}
 assert.equal(actual.rows.length,189);assert.equal(expected.length,189);
 for(let i=0;i<189;i++){const a=actual.rows[i],e=expected[i];assert.equal(a.position,i+1);for(const k of ['srcRow','code','name','unit','price'])assert.equal(a[k],e[k],`position ${i+1} ${k}`);}
 assert.equal(actual.meta.parserVersion,4); console.log('All 189 original positions: order, source rows, codes, names, units and prices verified.');
}
console.log('Act import regression tests passed.');
