import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseContractPdf, tableRowBoundaries, extractRowsFromBands} from '../js/pdf-contract.js';
// Synthetic PDF drawing and text geometry: coordinates must use the graphics CTM.
const OPS={save:1,restore:2,transform:3,constructPath:4,rectangle:5};
assert.deepEqual(tableRowBoundaries({fnArray:[1,3,4,4,2],argsArray:[[],[.9,0,0,.9,30,60],[[5],[100,500,400,1]],[[5],[100,450,400,1]],[]]},OPS),[510.45,465.45]);
const item=(str,x,y)=>({str,transform:[8,0,0,8,x,y],width:str.length*4,height:8});
const items=[item('ГЭСН27-12-004-01',80,80),item('Начало названия',155,88),item('продолжение названия',155,76),item('км',400,80),item('10,00',460,80),item('12,00',540,80),item('9,00',620,80),item('Раздел 4',155,60),item('0,00',620,60)];
assert.deepEqual(extractRowsFromBands(items,[100,70,50]),[{code:'ГЭСН27-12-004-01',name:'Начало названия продолжение названия',unit:'км',price:9,printedRow:null}]);
assert.equal(extractRowsFromBands([item('31',60,80),...items],[100,70,50])[0].printedRow,31);
// Optional local fixture; never upload contracts to the repository.
if(process.argv[2]){
 const result=await parseContractPdf(new Uint8Array(fs.readFileSync(process.argv[2])));
 const expected=[918798.88,61068.23,2976.06,3492.34,3492.34,75870.84,99673.45,123476.07,67753.59,109109.67,170996.63,34166.8,1135.74,7950.09,3514.78,7797.87,17426.15];
 for(let i=0;i<expected.length;i++)assert.equal(result.rows.find(r=>r.row===31+i).price,expected[i],`position ${31+i}`);
 assert.equal(result.rows.length,1012);
 assert.match(result.rows[30].name,/толщиной слоя 15 см/);
 assert.doesNotMatch(result.rows[30].name,/На каждые/);
 assert.match(result.rows[35].name,/группа грунтов: 2$/);
 assert.doesNotMatch(result.rows[35].name,/Раздел/);
 assert.equal(result.meta.parserVersion,4);
 assert.equal(result.rows.find(r=>r.row===530).printedRow,529);
 console.log('Real PDF: positions 31–47, names, prices, count and parser version passed.');
}
console.log('PDF geometry regression tests passed.');
