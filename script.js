const $ = id => document.getElementById(id);
const defaults = {'вода':1,'молоко':1.03,'олія':0.92,'борошно':0.53,'цукор':0.85,'мед':1.42,'сіль':1.2};
let densities = {...defaults};
fetch('ingredients.json').then(r=>r.ok?r.json():Promise.reject()).then(x=>densities={...densities,...x}).catch(()=>{});
// ---------- Розпізнавання інгредієнтів (українською та російською) ----------
// Одиниці виміру: канонічна назва, тип і множник (г для маси, мл для обʼєму).
// Регулярні вирази всередині — лише з незахоплювальними групами (?:...).
const UNIT_DEFS = [
 {unit:'кг',kind:'mass',k:1000,re:'кг|кілограм(?:ів|а|и)?|килограмм(?:ов|а|ы)?|килограм(?:ов|а|ы)?'},
 {unit:'г',kind:'mass',k:1,re:'г|гр|грам(?:ів|а|и)?|грамм(?:ов|а|ы)?'},
 {unit:'мл',kind:'volume',k:1,re:'мл|мілілітр(?:ів|а|и)?|миллилитр(?:ов|а|ы)?'},
 {unit:'л',kind:'volume',k:1000,re:'л|літр(?:ів|а|и)?|литр(?:ов|а|ы)?'},
 {unit:'скл.',kind:'volume',k:250,re:'склян(?:ка|ки|ку|ок)|стакан(?:ів|ов|а|и)?|скл'},
 {unit:'ст. л.',kind:'volume',k:15,re:'(?:ст|стол)\\.?\\s*(?:л|ложк(?:а|и|у)|ложок|ложек)|столов(?:а|у|і|их|ая|ую|ые|ых)\\s+(?:ложк(?:а|и|у)|ложок|ложек)'},
 {unit:'ч. л.',kind:'volume',k:5,re:'ч\\.?\\s*(?:л|ложк(?:а|и|у)|ложок|ложек)|чайн(?:а|у|і|их|ая|ую|ые|ых)\\s+(?:ложк(?:а|и|у)|ложок|ложек)'},
 {unit:'шт',kind:'count',k:1,re:'шт|штук(?:а|и|у)?'},
 {unit:'зубч.',kind:'count',k:1,re:'зубч(?:ик(?:а|и|ів|ов)?)?'},
 {unit:'пучок',kind:'count',k:1,re:'пуч(?:ок|ка|ки|ків|ков)'},
 {unit:'дрібка',kind:'count',k:1,re:'дрібк(?:а|и|у)|дрібок|щіпк(?:а|и|у)|щіпок|щепотк(?:а|и|у)|щепоток'},
 {unit:'пачка',kind:'count',k:1,re:'пач(?:ка|ки|ку|ок)|упаковк(?:а|и|у)|упаковок|уп'},
 {unit:'банка',kind:'count',k:1,re:'бан(?:ка|ки|ку|ок)'}
];
const UNIT_RE = new RegExp('^\\s*(?:'+UNIT_DEFS.map(d=>'('+d.re+')').join('|')+')\\.?(?!\\p{L})','iu');
// Кількість: мішаний дріб «1 1/2», дріб «1/2», число «1,5»; діапазон «80–100», «від 2 до 3».
const NUM = '\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?';
const QTY_RE = new RegExp(`(?<![\\p{L}\\d.,/])(?:(?:від|от)\\s+)?(${NUM})(?:\\s*(?:-|–|—|‑|до)\\s*(${NUM}))?(?![\\d/]|\\s*%)`,'giu');
const FRACTIONS = {'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8','⅕':'1/5'};
// Позначки без кількості («за смаком», «по вкусу») — не кількість і не частина назви.
const TASTE_RE = /\(?\s*(за\s+смаком|по\s+смаку|до\s+смаку|на\s+смак|по\s+вкусу|за\s+бажанням|по\s+бажанню|по\s+желанию|опціонально|необов[ʼ'’]?язково|для\s+подачі|для\s+подачи|на\s+кінчику\s+ножа|на\s+кончике\s+ножа)\s*\)?/iu;
// Заголовки розділів рецепта: «Для основи», «Для крему», «Ингредиенты» тощо.
const HEADER_RE = /^(?:інгредієнти|ингредиенты|продукти|продукты|для\s+\p{L}.*|начинка|тісто|тесто|крем|глазур|глазурь|соус|основа|декор|заправка|маринад|прикраса|украшение|посипка|присипка|посыпка)$/iu;
// Шаблони назв продуктів для пошуку густини (перевіряються для кожного слова назви).
const densityPatterns = {
 'вода':/^(?:вода|води|воді|воду|водою|воды|водой|воде)$/,
 'молоко':/^молок/,
 'олія':/^(?:олі[яїюєі]|олією|растительн|подсолнечн|соняшников|оливков)/,
 'борошно':/^(?:борошн|мук(?:а|и|у|е|ой|ою)?$)/,
 'цукор':/^(?:цукор|цукр|сахар)/,
 'мед':/^(?:мед|меду|меда|медом|меді|меде)$/,
 'сіль':/^(?:сіль|солі|сіллю|соль|соли|солью)$/
};
// Продукти зі «схожою» назвою, але іншою густиною — масу для них не вгадуємо.
const DENSITY_EXCLUDE = /пудр|згущ|сгущ|сух/;
const normalize = s=>s.toLowerCase().replace(/ё/g,'е').trim();
const round2 = n=>Math.round(n*100)/100;
const fmt = n => (n!==0&&Math.abs(n)<0.01?Number(n.toPrecision(2)):round2(n)).toLocaleString('uk-UA',{maximumFractionDigits:4});
const fmtRange = (a,b) => b==null?fmt(a):`${fmt(a)}–${fmt(b)}`;
const escapeRe = s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function parseNumber(s){
 s=s.replace(',','.').trim();
 let m=s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
 if(m)return Number(m[3])?Number(m[1])+Number(m[2])/Number(m[3]):NaN;
 m=s.match(/^(\d+)\s*\/\s*(\d+)$/);
 if(m)return Number(m[2])?Number(m[1])/Number(m[2]):NaN;
 return Number(s);
}
function prepareLine(line){
 let s=String(line).replace(/ /g,' ').replace(/⁄/g,'/')
  .replace(/(\d)?([½¼¾⅓⅔⅛⅜⅝⅞⅕])/g,(m,d,f)=>(d?d+' ':' ')+FRACTIONS[f])
  .replace(/\*\*|__/g,'').trim()
  .replace(/^#+\s*/,'').replace(/^[-–—•*·▪●✓✔]+\s*/,'').replace(/^\d+\)\s+/,'');
 // «1. Борошно — 200 г»: номер пункту списку, якщо далі ще є кількість.
 if(/^\d+\.\s+\p{L}/u.test(s)&&/\d/.test(s.replace(/^\d+\.\s+/,'')))s=s.replace(/^\d+\.\s+/,'');
 // «пів склянки», «полстакана» → 1/2
 s=s.replace(/(^|\s)(?:пів|пол)\s*(?=склян|стакан|ложк|літр|литр|кіло|кило|чайн|столов|ст\.|ч\.)/giu,'$11/2 ');
 return s.replace(/\s{2,}/g,' ').trim();
}
const stripParens = s=>s.replace(/\([^)]*\)/g,' ').replace(/\s{2,}/g,' ').trim();
const isHeaderText = s=>HEADER_RE.test(stripParens(s).replace(/[:.]+$/,'').trim());
const cleanName = s=>s.replace(/\(\s*\)/g,' ').replace(/\s{2,}/g,' ').replace(/^[\s\-–—:;,.]+|[\s\-–—:;,.]+$/g,'').trim();
function findQuantity(s){
 const found=[];
 for(const m of s.matchAll(QTY_RE)){
  const end=m.index+m[0].length, um=s.slice(end).match(UNIT_RE);
  const def=um?UNIT_DEFS[um.slice(1).findIndex(Boolean)]:null;
  found.push({start:m.index,end:end+(um?um[0].length:0),amount:parseNumber(m[1]),amountMax:m[2]?parseNumber(m[2]):null,def});
 }
 // Пріоритет — кількість із відомою одиницею («Яйця С1 — 2 шт», «Борошно (тип 550) 200 г»).
 return found.find(q=>q.def)||found[0]||null;
}
// Розбір одного рядка. Порядок слів довільний: «500 мл молока», «Молоко — 500 мл», «Борошно: 200 г».
function parse(line){
 let s=prepareLine(line);
 const original=String(line).trim();
 if(!s)return {original,error:true};
 let section='';
 const colon=s.indexOf(':');
 if(colon>=0){
  const left=s.slice(0,colon).trim(),right=s.slice(colon+1).trim();
  if(!right)return {original,header:true,name:cleanName(left)};
  if(isHeaderText(left)){section=cleanName(left);s=right;}
 }
 if(!findQuantity(s)&&isHeaderText(s))return {original,header:true,name:cleanName(s)};
 let note='';
 const taste=s.match(TASTE_RE);
 if(taste){note=taste[1].toLowerCase();s=s.replace(TASTE_RE,' ');}
 const q=findQuantity(s);
 const name=cleanName(q?s.slice(0,q.start)+' '+s.slice(q.end):s);
 if(!/\p{L}/u.test(name)||(q&&!Number.isFinite(q.amount))||(q&&q.amountMax!=null&&!Number.isFinite(q.amountMax)))return {original,error:true};
 const item={original,name,amount:null,amountMax:null,unit:'',unitKind:'',unitFactor:1,note,section};
 if(q){
  item.amount=q.amount;
  item.amountMax=q.amountMax!=null&&q.amountMax!==q.amount?q.amountMax:null;
  // Одиниця лише якщо вона справді є в рядку — нічого не вигадуємо.
  if(q.def){item.unit=q.def.unit;item.unitKind=q.def.kind;item.unitFactor=q.def.k;}
 }
 return item;
}
// Розбір усього рецепта: заголовки задають розділ і не є інгредієнтами.
// Повторення в рецепті зберігаються — кожен рядок має свій номер line.
function parseRecipe(text){
 const items=[];let section='';
 String(text||'').split(/\r?\n/).forEach((line,index)=>{
  if(!line.trim())return;
  const item=parse(line);
  if(item.header){section=item.name;return;}
  item.line=index;
  if(!item.error&&!item.section)item.section=section;
  items.push(item);
 });
 return items;
}
function findDensity(name){
 const n=normalize(name);
 if(DENSITY_EXCLUDE.test(n))return null;
 const words=n.split(/[^\p{L}ʼ']+/u).filter(Boolean);
 return Object.keys(densities).find(key=>{
  const k=normalize(key);
  const re=densityPatterns[k]||new RegExp('^'+escapeRe(k.length>4?k.slice(0,-1):k));
  return words.some(w=>re.test(w));
 })||null;
}
function scaled(item,factor){return [item.amount*factor,item.amountMax==null?null:item.amountMax*factor]}
function convert(item,factor,unit){
 if(item.error)return {value:'Не розпізнано',note:'Введи: 500 мл молока'};
 if(item.amount==null)return {value:item.note||'—',note:'Кількість не вказано в рецепті'};
 const [lo,hi]=scaled(item,factor);
 if(!item.unit)return {value:fmtRange(lo,hi),note:'Одиницю не вказано — залишено як у рецепті'};
 if(item.unitKind==='count'){
  const whole=[lo,hi].every(v=>v==null||Number.isInteger(round2(v)));
  return {value:`${fmtRange(lo,hi)} ${item.unit}`,note:whole?'Кількісна одиниця':'Дробова кількість — перевір вручну'};
 }
 let perUnit=item.unitFactor,approx=false,note='Точне перетворення одиниць';
 if(item.unitKind==='volume'){
  const key=findDensity(item.name);
  if(!key)return {value:`${fmtRange(lo,hi)} ${item.unit}`,note:'Немає густини продукту — масу не вгадуємо'};
  perUnit=item.unitFactor*densities[key];approx=true;
  note=(item.unit==='мл'||item.unit==='л')?'Приблизно: густина залежить від продукту й температури':'Приблизно: обʼєм посуду та насипна густина можуть відрізнятися';
 }
 const gLo=lo*perUnit,gHi=hi==null?null:hi*perUnit;
 const kg=unit==='kg'||(unit==='auto'&&(gHi==null?gLo:gHi)>=1000),d=kg?1000:1;
 return {value:`${approx?'≈ ':''}${fmtRange(gLo/d,gHi==null?null:gHi/d)} ${kg?'кг':'г'}`,note};
}
function classicValue(item,factor){
 if(item.error)return 'Не розпізнано';
 if(item.amount==null)return item.note||'—';
 const [lo,hi]=scaled(item,factor);
 return `${fmtRange(lo,hi)} ${item.unit}`.trim();
}
function render(){
 const lines=parseRecipe($('recipe').value);
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
 lines.forEach(item=>{
  const result=convert(item,factor,$('unit').value),tr=document.createElement('tr');
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
// Ключ рецепта: однаковий текст → однаковий ключ (порції на ключ не впливають).
function recipeKey(text){
 const s=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).join('\n');
 let h=0;for(const c of s)h=(Math.imul(h,31)+c.codePointAt(0))>>>0;
 return 'r'+h.toString(36);
}
// Повторне додавання того самого рецепта оновлює його позиції, а не дублює їх.
// Повтори всередині рецепта (різні рядки) зберігаються як окремі позиції.
function mergeShopping(list,entries,key){
 const out=list.slice();
 entries.forEach(e=>{
  const i=out.findIndex(x=>x.recipe===key&&x.line===e.line);
  if(i>=0){const old=out[i];out[i]={...old,name:e.name,amount:e.amount,done:old.amount===e.amount&&old.name===e.name?old.done:false};}
  else out.push({...newShoppingItem(e.name,e.amount),recipe:key,line:e.line});
 });
 return out;
}
function shoppingEntries(text,factor,unit){
 return parseRecipe(text).filter(x=>!x.error).map(item=>({line:item.line,name:item.name,amount:convert(item,factor,unit).value}));
}
$('addToShopping').addEventListener('click',()=>{
 const original=Number($('originalServings').value),target=Number($('targetServings').value);
 if(!Number.isInteger(original)||original<1||!Number.isInteger(target)||target<1){alert('Вкажи коректну кількість порцій');return}
 const text=$('recipe').value;
 const entries=shoppingEntries(text,target/original,$('unit').value);
 if(!entries.length){alert('Спочатку введи інгредієнти у форматі: 500 мл молока');return}
 shopping=mergeShopping(shopping,entries,recipeKey(text));
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
