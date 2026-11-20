// Локальні перевірки логіки, запуск: node test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/script.js','utf8');
const sandbox={fetch:()=>Promise.reject(),document:{getElementById:()=>({addEventListener(){},value:'2',textContent:'',replaceChildren(){},append(){}}),querySelectorAll:()=>[],createElement:()=>({append(){},setAttribute(){},addEventListener(){}})},localStorage:{getItem:()=>null},crypto:{randomUUID:()=> 'id'},console};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const run=expr=>vm.runInContext(expr,sandbox);
assert.equal(run("convert(parse('500 мл молока'),1,'g').value"),'≈ 515 г');
assert.equal(run("convert(parse('1 кг цукор'),1,'g').value"),'1 000 г');
assert.equal(run("convert(parse('3 шт яйця'),2,'auto').value"),'6 шт');
assert.equal(run("convert(parse('500 мл невідомого продукту'),1,'g').value"),'500 мл');
assert.equal(run("convert(parse('500 мл молока'),2,'kg').value"),'≈ 1,03 кг');
assert.equal(run("parse('2 склянки борошна').error"),undefined);
console.log('6 перевірок пройдено');
