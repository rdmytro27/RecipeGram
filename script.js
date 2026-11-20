const $ = id => document.getElementById(id);
const defaults = {'вода':1,'молоко':1.03,'олія':0.92,'борошно':0.53,'цукор':0.85,'мед':1.42,'сіль':1.2};
let densities = {...defaults};
fetch('ingredients.json').then(r=>r.ok?r.json():Promise.reject()).then(x=>densities={...densities,...x}).catch(()=>{});
const aliases = {'л':1000,'літр':1000,'літра':1000,'літрів':1000,'мл':1,'склянка':250,'склянки':250,'склянок':250,'ст. л.':15,'ст.л.':15,'ст л':15,'столова ложка':15,'столові ложки':15,'ч. л.':5,'ч.л.':5,'ч л':5,'чайна ложка':5,'чайні ложки':5};
const countUnits = ['шт','шт.','штука','штуки','штук','зубчик','зубчики','зубчиків','пучок','пучки','пучків'];
const normalize = s=>s.toLowerCase().replace(/ё/g,'е').trim();
const fmt = n => Number(n.toFixed(2)).toLocaleString('uk-UA');
function parse(line){
 const cleaned=line.trim().replace(/^[-•*]\s*/, '');
 const match=cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(кг|г|мл|літрів|літра|літр|л|склянок|склянки|склянка|ст\.\s*л\.|ст\s*л|столова ложка|столові ложки|ч\.\s*л\.|ч\s*л|чайна ложка|чайні ложки|шт\.|шт|штука|штуки|штук|зубчиків|зубчики|зубчик|пучків|пучки|пучок)\s+(.+)$/i);
 if(!match)return {original:cleaned,error:true};
 return {amount:Number(match[1].replace(',','.')),unit:normalize(match[2]).replace(/\s+/g,' '),name:match[3].trim(),original:cleaned};
}
function convert(item,factor,unit){
 if(item.error)return {value:'Не розпізнано',note:'Введи: 500 мл молока'};
 const amount=item.amount*factor, u=item.unit;
 if(countUnits.includes(u))return {value:`${fmt(amount)} ${u}`,note:Number.isInteger(amount)?'Кількісна одиниця':'Дробова кількість — перевір вручну'};
 let grams,approx=false,note='Точне перетворення одиниць';
 if(u==='г')grams=amount;
 else if(u==='кг')grams=amount*1000;
 else {
   const name=normalize(item.name);
   const stems={'молоко':'молок','борошно':'борошн','вода':'вод','олія':'олі','цукор':'цукр','мед':'мед','сіль':'сол'};
   const key=Object.keys(densities).find(k=>name.includes(stems[k]||k));
   if(!key)return {value:`${fmt(amount)} ${u}`,note:'Немає густини продукту — масу не вгадуємо'};
   const volume=aliases[u];
   if(!volume)return {value:`${fmt(amount)} ${u}`,note:'Невідома одиниця'};
   grams=amount*volume*densities[key];approx=true;
   note=(u.includes('склян')||u.includes('ложк')||u.includes('л.'))?'Приблизно: обʼєм посуду та насипна густина можуть відрізнятися':'Приблизно: густина залежить від продукту й температури';
 }
 const kg=unit==='kg'||(unit==='auto'&&grams>=1000);
 return {value:`${approx?'≈ ':''}${fmt(kg?grams/1000:grams)} ${kg?'кг':'г'}`,note};
}
function classicValue(item,factor){
 if(item.error)return 'Не розпізнано';
 return `${fmt(item.amount*factor)} ${item.unit}`;
}
function render(){
 const lines=$('recipe').value.split('\n').filter(s=>s.trim());
 const original=Number($('originalServings').value),target=Number($('targetServings').value);
 if(!Number.isInteger(original)||!Number.isInteger(target)||original<1||target<1){
  $('portionSummary').textContent='Вкажи цілу додатну кількість порцій';
  $('results').textContent='Виправ кількість порцій для розрахунку.';
  return;
 }
 const factor=target/original;
 $('portionSummary').textContent=`${original} → ${target} порцій · множник ×${fmt(factor)}`;
 if(!lines.length){$('results').textContent='Встав інгредієнти рецепта.';return;}
 const table=document.createElement('table');
 const head=document.createElement('tr');
 ['Інгредієнт','Класичний рецепт','У грамах / кілограмах','Примітка'].forEach(s=>{
  const th=document.createElement('th');th.textContent=s;head.append(th);
 });
 table.append(head);
 lines.forEach(line=>{
  const item=parse(line),result=convert(item,factor,$('unit').value),tr=document.createElement('tr');
  [item.name||item.original,classicValue(item,factor),result.value,result.note].forEach(s=>{
   const td=document.createElement('td');td.textContent=s;tr.append(td);
  });
  table.append(tr);
 });
 $('results').replaceChildren(table);
}
$('convert').addEventListener('click',render);$('unit').addEventListener('change',render);['originalServings','targetServings'].forEach(id=>$(id).addEventListener('input',render));$('plusPortion').addEventListener('click',()=>{$('targetServings').value=Math.max(1,Number($('targetServings').value)||1)+1;render()});$('minusPortion').addEventListener('click',()=>{$('targetServings').value=Math.max(1,(Number($('targetServings').value)||1)-1);render()});
$('save').addEventListener('click',()=>{localStorage.setItem('recipegram-recipe',JSON.stringify({recipe:$('recipe').value,originalServings:$('originalServings').value,targetServings:$('targetServings').value,unit:$('unit').value}));alert('Рецепт збережено на цьому пристрої')});
$('load').addEventListener('click',()=>{const saved=localStorage.getItem('recipegram-recipe');if(!saved){alert('Немає збереженого рецепта');return;}const x=JSON.parse(saved);$('recipe').value=x.recipe;$('originalServings').value=x.originalServings||1;$('targetServings').value=x.targetServings||x.factor||1;$('unit').value=x.unit;render()});


// Список покупок зберігається лише у цьому браузері.
const SHOP_KEY='recipegram-shopping-v1';
function readShopping(){try{const v=JSON.parse(localStorage.getItem(SHOP_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
let shopping=readShopping();
function persistShopping(){localStorage.setItem(SHOP_KEY,JSON.stringify(shopping));renderShopping()}
function renderShopping(){
 const list=$('shoppingList');list.replaceChildren();
 $('shoppingCount').textContent=String(shopping.filter(x=>!x.done).length);
 if(!shopping.length){const p=document.createElement('p');p.className='muted';p.textContent='Список порожній. Додай інгредієнти з рецепта або вручну.';list.append(p);return}
 shopping.forEach(item=>{
  const row=document.createElement('div');row.className='shopping-item'+(item.done?' bought':'');
  const check=document.createElement('input');check.type='checkbox';check.checked=!!item.done;check.setAttribute('aria-label','Куплено: '+item.name);check.addEventListener('change',()=>{item.done=check.checked;persistShopping()});
  const info=document.createElement('div');info.className='shopping-info';
  const name=document.createElement('strong');name.textContent=item.name;
  const amount=document.createElement('span');amount.textContent=item.amount;
  info.append(name,amount);
  const remove=document.createElement('button');remove.type='button';remove.className='remove-item';remove.textContent='×';remove.setAttribute('aria-label','Видалити '+item.name);remove.addEventListener('click',()=>{shopping=shopping.filter(x=>x.id!==item.id);persistShopping()});
  row.append(check,info,remove);list.append(row);
 });
}
function newShoppingItem(name,amount){return {id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name,amount,done:false}}
$('addToShopping').addEventListener('click',()=>{
 const original=Number($('originalServings').value),target=Number($('targetServings').value);
 if(!Number.isInteger(original)||original<1||!Number.isInteger(target)||target<1){alert('Вкажи коректну кількість порцій');return}
 const lines=$('recipe').value.split('\n').filter(x=>x.trim());
 const parsed=lines.map(parse).filter(x=>!x.error);
 if(!parsed.length){alert('Спочатку введи інгредієнти у форматі: 500 мл молока');return}
 const factor=target/original;
 parsed.forEach(item=>shopping.push(newShoppingItem(item.name,convert(item,factor,$('unit').value).value)));
 persistShopping();showTab('shopping');
});
$('shoppingForm').addEventListener('submit',e=>{e.preventDefault();const name=$('shoppingName').value.trim(),amount=$('shoppingAmount').value.trim();if(!name||!amount)return;shopping.push(newShoppingItem(name,amount));persistShopping();$('shoppingForm').reset();$('shoppingName').focus()});
$('clearBought').addEventListener('click',()=>{shopping=shopping.filter(x=>!x.done);persistShopping()});
$('clearShopping').addEventListener('click',()=>{if(shopping.length&&confirm('Видалити весь список покупок?')){shopping=[];persistShopping()}});
function showTab(name){
 $('recipesView').hidden=name!=='recipes';$('shoppingView').hidden=name!=='shopping';
 document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
renderShopping();
