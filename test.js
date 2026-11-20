// Локальні перевірки логіки, запуск: node test.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/script.js','utf8');
const sandbox={fetch:()=>Promise.reject(),document:{getElementById:()=>({addEventListener(){},value:'2',textContent:'',replaceChildren(){},append(){}}),querySelectorAll:()=>[],createElement:()=>({append(){},setAttribute(){},addEventListener(){}})},localStorage:{getItem:()=>null},crypto:{randomUUID:()=> 'id'},console};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const run=expr=>vm.runInContext(expr,sandbox);
// Обʼєкти з vm-контексту мають інші прототипи — порівнюємо через JSON.
const call=(fn,...args)=>JSON.parse(JSON.stringify(sandbox[fn](...args)));
const parse=line=>call('parse',line);
const value=(line,factor=1,unit='auto')=>sandbox.convert(sandbox.parse(line),factor,unit).value;
const classic=(line,factor=1)=>sandbox.classicValue(sandbox.parse(line),factor);
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));
const Q=['name','amount','amountMax','unit'];
let count=0;
const test=(title,fn)=>{try{fn();count++}catch(e){console.error('✗ '+title);throw e}};

test('попередні перевірки',()=>{
 assert.equal(run("convert(parse('500 мл молока'),1,'g').value"),'≈ 515 г');
 assert.equal(run("convert(parse('1 кг цукор'),1,'g').value"),(1000).toLocaleString('uk-UA')+' г');
 assert.equal(run("convert(parse('3 шт яйця'),2,'auto').value"),'6 шт');
 assert.equal(run("convert(parse('500 мл невідомого продукту'),1,'g').value"),'500 мл');
 assert.equal(run("convert(parse('500 мл молока'),2,'kg').value"),'≈ 1,03 кг');
 assert.equal(run("parse('2 склянки борошна').error"),undefined);
});

test('дроби',()=>{
 assert.deepEqual(pick(parse('1/2 склянки молока'),Q),{name:'молока',amount:0.5,amountMax:null,unit:'скл.'});
 assert.deepEqual(pick(parse('1 1/2 ст. л. цукру'),Q),{name:'цукру',amount:1.5,amountMax:null,unit:'ст. л.'});
 assert.deepEqual(pick(parse('1/4 ч.л. солі'),Q),{name:'солі',amount:0.25,amountMax:null,unit:'ч. л.'});
 assert.equal(parse('½ ч. л. соли').amount,0.5);
 assert.equal(parse('1½ склянки борошна').amount,1.5);
 assert.equal(parse('пів склянки молока').amount,0.5);
 assert.equal(parse('1,5 л води').amount,1.5);
 assert.equal(value('1/2 склянки молока'),'≈ 128,75 г');
 assert.equal(classic('1 1/2 ст. л. цукру',2),'3 ст. л.');
 assert.equal(value('1/2 ч. л. солі'),'≈ 3 г');
});

test('діапазони',()=>{
 assert.deepEqual(pick(parse('80–100 г цукру'),Q),{name:'цукру',amount:80,amountMax:100,unit:'г'});
 assert.deepEqual(pick(parse('Масло вершкове 100-120 г'),Q),{name:'Масло вершкове',amount:100,amountMax:120,unit:'г'});
 assert.deepEqual(pick(parse('Сахар — 80 — 100 г'),Q),{name:'Сахар',amount:80,amountMax:100,unit:'г'});
 assert.deepEqual(pick(parse('від 2 до 3 яєць'),Q),{name:'яєць',amount:2,amountMax:3,unit:''});
 assert.equal(value('80–100 г цукру',2),'160–200 г');
 assert.equal(classic('80–100 г цукру',1.5),'120–150 г');
 assert.equal(value('800-1200 г борошна'),'0,8–1,2 кг');
 assert.equal(value('1/2-1 склянка молока',2),'≈ 257,5–515 г');
});

test('нерозпізнані та відсутні одиниці — не вигадуємо',()=>{
 assert.deepEqual(pick(parse('2 жмені горіхів'),Q),{name:'жмені горіхів',amount:2,amountMax:null,unit:''});
 assert.equal(value('2 жмені горіхів',1.5),'3');
 assert.equal(sandbox.convert(sandbox.parse('2 жмені горіхів'),1,'g').note,'Одиницю не вказано — залишено як у рецепті');
 assert.deepEqual(pick(parse('5 см імбиру'),Q),{name:'см імбиру',amount:5,amountMax:null,unit:''});
 assert.deepEqual(pick(parse('3 яйця'),Q),{name:'яйця',amount:3,amountMax:null,unit:''});
 assert.equal(classic('3 яйця',2),'6');
 assert.equal(value('Яйця — 3',2),'6');
 const salt=parse('Сіль за смаком');
 assert.deepEqual(pick(salt,[...Q,'note']),{name:'Сіль',amount:null,amountMax:null,unit:'',note:'за смаком'});
 assert.equal(value('Сіль за смаком'),'за смаком');
 assert.equal(value('Перец по вкусу'),'по вкусу');
});

test('українські та російські назви й одиниці',()=>{
 assert.equal(value('2 стакана муки'),'≈ 265 г');
 assert.equal(value('2 склянки борошна'),'≈ 265 г');
 assert.equal(value('Соль — 1 ч. л.'),'≈ 6 г');
 assert.equal(value('Сахар 100 грамм'),'100 г');
 assert.equal(value('2 столовые ложки растительного масла'),'≈ 27,6 г');
 assert.equal(value('2 столові ложки олії'),'≈ 27,6 г');
 assert.equal(value('1 литр молока'),'≈ 1,03 кг');
 assert.equal(value('3 ст. ложки мёда'),'≈ 63,9 г');
 assert.equal(value('2 зубчика чеснока',2),'4 зубч.');
 assert.equal(value('1 щепотка соли'),'1 дрібка');
 // Не плутаємо схожі продукти: цукрова пудра, водка, вершкове масло.
 assert.equal(value('1 склянка цукрової пудри'),'1 скл.');
 assert.equal(value('50 мл водки'),'50 мл');
 assert.equal(value('100 мл сливочного масла'),'100 мл');
});

test('порядок слів довільний',()=>{
 assert.deepEqual(pick(parse('Молоко — 500 мл'),Q),{name:'Молоко',amount:500,amountMax:null,unit:'мл'});
 assert.deepEqual(pick(parse('Борошно: 200 г'),Q),{name:'Борошно',amount:200,amountMax:null,unit:'г'});
 assert.deepEqual(pick(parse('яйця 3 шт.'),Q),{name:'яйця',amount:3,amountMax:null,unit:'шт'});
 assert.deepEqual(pick(parse('- 200г борошна'),Q),{name:'борошна',amount:200,amountMax:null,unit:'г'});
 assert.deepEqual(pick(parse('Вершки 33% — 200 мл'),Q),{name:'Вершки 33%',amount:200,amountMax:null,unit:'мл'});
 assert.deepEqual(pick(parse('Яйця С1 — 2 шт'),Q),{name:'Яйця С1',amount:2,amountMax:null,unit:'шт'});
 assert.deepEqual(pick(parse('1. Борошно — 300 г'),Q),{name:'Борошно',amount:300,amountMax:null,unit:'г'});
});

test('заголовки не є інгредієнтами',()=>{
 const items=call('parseRecipe',['Для основи:','200 г борошна','Для крему','100 г цукру','**Для глазурі:**','50 г шоколаду','Ингредиенты','Для начинки: 2 яблука','Крем:'].join('\n'));
 assert.deepEqual(items.map(x=>[x.name,x.section]),[['борошна','Для основи'],['цукру','Для крему'],['шоколаду','Для глазурі'],['яблука','Для начинки']]);
 assert.ok(items.every(x=>!x.error));
 assert.equal(parse('Для подачі').header,true);
 assert.equal(parse('Зелень для подачі').header,undefined);
});

test('повтори з рецепта зберігаються, випадкові дублікати — ні',()=>{
 const recipe='Для основи:\n100 г цукру\n\nДля крему:\n100 г цукру\n2 яйця';
 const entries=call('shoppingEntries',recipe,1,'auto');
 assert.deepEqual(entries.map(e=>[e.name,e.amount]),[['цукру','100 г'],['цукру','100 г'],['яйця','2']]);
 const key=sandbox.recipeKey(recipe);
 let list=sandbox.mergeShopping([],sandbox.shoppingEntries(recipe,1,'auto'),key);
 assert.equal(list.length,3);
 list[2].done=true;
 // Повторне натискання — без дублікатів, стан «куплено» зберігається.
 list=sandbox.mergeShopping(list,sandbox.shoppingEntries(recipe,1,'auto'),key);
 assert.equal(list.length,3);
 assert.equal(list[2].done,true);
 // Зміна порцій оновлює кількості замість додавання нових позицій.
 list=sandbox.mergeShopping(list,sandbox.shoppingEntries(recipe,2,'auto'),key);
 assert.deepEqual(JSON.parse(JSON.stringify(list.map(x=>x.amount))),['200 г','200 г','4']);
 assert.equal(list[2].done,false);
 // Інший рецепт додається окремо; ручні позиції не зачіпаються.
 const manual=[{id:'m',name:'хліб',amount:'1',done:false}];
 list=sandbox.mergeShopping(manual,sandbox.shoppingEntries('100 г цукру',1,'auto'),sandbox.recipeKey('100 г цукру'));
 assert.equal(list.length,2);
 assert.equal(sandbox.recipeKey('a\r\n b '),sandbox.recipeKey('a\nb'));
});

test('до покупок передаються всі розпізнані продукти',()=>{
 const entries=call('shoppingEntries','Для тіста:\n2 1/2 склянки борошна\n3 яйця\n2 жмені горіхів\nСіль за смаком\n80–100 г цукру\n???',1,'auto');
 assert.deepEqual(entries.map(e=>[e.name,e.amount]),[['борошна','≈ 331,25 г'],['яйця','3'],['жмені горіхів','2'],['Сіль','за смаком'],['цукру','80–100 г']]);
});

test('перерахунок порцій',()=>{
 assert.equal(value('300 г борошна',3/2),'450 г');
 assert.equal(value('3 яйця',2/3),'2');
 assert.equal(value('1 шт яблуко',1/3),'0,33 шт');
 assert.equal(sandbox.convert(sandbox.parse('1 шт яблуко'),1/3,'auto').note,'Дробова кількість — перевір вручну');
 assert.equal(sandbox.convert(sandbox.parse('3 шт яйця'),2/3,'auto').note,'Кількісна одиниця');
 assert.equal(value('1 ч. л. солі',1/4),'≈ 1,5 г');
 assert.equal(classic('1 ч. л. солі',1/8),'0,13 ч. л.');
});

console.log(`${count} груп перевірок пройдено`);
