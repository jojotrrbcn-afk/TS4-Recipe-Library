(() => {
'use strict';
const api=window.PalatePlannerBridge;
if(!api)return;
const meals=[
  ['breakfast','Breakfast / Brunch'],
  ['lunch','Lunch'],
  ['dinner','Dinner'],
  ['snack','Snack'],
  ['dessert','Dessert'],
  ['drinks','Drinks']
];
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let simId='',week='',selected='',drag=null;

function keyForDate(date){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function dateFromKey(key){
  const m=String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?new Date(+m[1],+m[2]-1,+m[3]):new Date();
}
function mondayOf(date){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()-(d.getDay()+6)%7);
  return keyForDate(d);
}
function currentWeek(){if(!week)week=mondayOf(new Date());return week}
function storage(){
  const state=api.getState();
  if(!state.mealPlans||typeof state.mealPlans!=='object'||Array.isArray(state.mealPlans))state.mealPlans={};
  return state.mealPlans;
}
function currentSim(){
  const sims=api.getState().sims;
  if(!sims.some(s=>s.id===simId))simId=sims[0]?.id||'';
  return sims.find(s=>s.id===simId);
}
function currentPlan(){
  const sim=currentSim();
  return sim?storage()[sim.id+'::'+currentWeek()]:null;
}
function recipeMeal(recipe){
  const source=api.clean(recipe.kitchenMeal||'');
  const types=Array.isArray(recipe.types)?recipe.types.map(api.clean):[];
  const tags=source&&!['other','ingredient','baking'].includes(source)?[source]:types;
  if(tags.includes('breakfast')||tags.includes('brunch'))return 'breakfast';
  if(recipe.kind==='Drink'||tags.includes('drink')||tags.includes('drinks'))return 'drinks';
  for(const [key] of meals){
    if(key!=='breakfast'&&key!=='drinks'&&tags.includes(key))return key;
  }
  return '';
}
function candidates(sim){
  api.pvals(sim);
  return api.getState().recipes.filter(recipe=>Number(sim.ratings[recipe.id]?.score)>=3&&recipeMeal(recipe));
}
function shuffled(source){
  const arr=source.slice();
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(api.rand()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function makeSlots(sim,previous){
  const suitable=candidates(sim),groups={};
  for(const [key] of meals){
    const recipes=suitable.filter(r=>recipeMeal(r)===key);
    groups[key]={
      tiers:[5,4,3].map(score=>({score,weight:score===5?5:score===4?3:1,
        pool:recipes.filter(r=>Number(sim.ratings[r.id]?.score)===score).map(r=>r.id),bag:[],last:''}))
    };
  }
  const slots={};
  for(let d=0;d<7;d++){
    for(const [key] of meals){
      const group=groups[key],slot=d+':'+key;
      const tiers=group.tiers.filter(tier=>tier.pool.length);
      if(!tiers.length){slots[slot]='';continue}
      // Choose the preference tier first. This prevents a large collection of
      // neutral foods from overpowering a smaller collection of favourites.
      const total=tiers.reduce((sum,tier)=>sum+tier.weight,0);
      let roll=api.rand()*total,chosenTier=tiers[tiers.length-1];
      for(const tier of tiers){
        roll-=tier.weight;
        if(roll<0){chosenTier=tier;break}
      }
      if(!chosenTier.bag.length){
        chosenTier.bag=shuffled(chosenTier.pool);
        if(chosenTier.bag.length>1&&chosenTier.bag[0]===chosenTier.last){
          const index=chosenTier.bag.findIndex(id=>id!==chosenTier.last);
          [chosenTier.bag[0],chosenTier.bag[index]]=[chosenTier.bag[index],chosenTier.bag[0]];
        }
      }
      const alternative=chosenTier.bag.length>1?
        chosenTier.bag.findIndex(id=>id!==previous[slot]&&id!==chosenTier.last):-1;
      const choice=chosenTier.bag.splice(alternative<0?0:alternative,1)[0];
      slots[slot]=choice;
      chosenTier.last=choice;
    }
  }
  return slots;
}
function generate(){
  const sim=currentSim();
  if(!sim)return;
  if(!candidates(sim).length){
    api.toast('Taste-test recipes first. Meal plans use saved neutral, liked and loved opinions.');
    return;
  }
  const all=storage(),key=sim.id+'::'+currentWeek(),old=all[key];
  all[key]={simId:sim.id,weekStart:currentWeek(),slots:makeSlots(sim,old?.slots||{}),createdAt:new Date().toISOString()};
  if(!api.save()){if(old)all[key]=old;else delete all[key];return}
  selected='';
  api.render();
  api.toast(old?'Weekly menu randomised again.':'Weekly menu saved.');
}
function changeWeek(amount){
  const date=dateFromKey(currentWeek());
  date.setDate(date.getDate()+amount*7);
  week=keyForDate(date);
  selected='';
  api.render();
}
function move(from,to){
  const sim=currentSim(),plan=currentPlan();
  if(!sim||!plan?.slots||from===to)return false;
  if(!Object.prototype.hasOwnProperty.call(plan.slots,from)||!Object.prototype.hasOwnProperty.call(plan.slots,to))return false;
  const allowed=new Set(candidates(sim).map(r=>r.id));
  if(!allowed.has(plan.slots[from]))return false;
  const source=plan.slots[from],target=plan.slots[to]||'';
  plan.slots[from]=target;
  plan.slots[to]=source;
  if(!api.save()){plan.slots[from]=source;plan.slots[to]=target;return false}
  selected='';
  api.render();
  api.toast('Meal moved and saved.');
  return true;
}
function selectSlot(slot){
  const sim=currentSim(),plan=currentPlan();
  if(!sim||!plan?.slots||!Object.prototype.hasOwnProperty.call(plan.slots,slot))return;
  if(selected){
    const from=selected;
    selected='';
    if(from!==slot){if(!move(from,slot))api.render();return}
    api.render();
    return;
  }
  if(!new Set(candidates(sim).map(r=>r.id)).has(plan.slots[slot]))return;
  selected=slot;
  api.render();
}
function render(){
  const sim=currentSim(),start=dateFromKey(currentWeek());
  const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+6);
  const dateFormat=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'});
  const weekLabel=dateFormat.format(start)+' – '+dateFormat.format(end);
  const plan=currentPlan(),suitable=sim?candidates(sim):[];
  const byId=new Map(suitable.map(r=>[r.id,r]));
  const counts={5:0,4:0,3:0};
  suitable.forEach(recipe=>{counts[Number(sim.ratings[recipe.id].score)]++});

  let output=api.section('Weekly meal plan','Your personalised week at a glance, from familiar favourites to occasional neutral dishes.')+
    '<div class="card plan-top"><div class="plan-controls"><div class="field"><label for="plan-sim">Whose menu?</label><select id="plan-sim">'+
    api.opts(api.getState().sims,sim?.id||'','Choose a Sim')+'</select></div>'+
    '<div class="plan-week"><button type="button" class="btn ghost small" data-plan-action="previous" aria-label="Previous week">←</button>'+
    '<strong>Week of '+api.esc(weekLabel)+'</strong>'+
    '<button type="button" class="btn ghost small" data-plan-action="next" aria-label="Next week">→</button></div></div>'+
    '<div class="plan-legend" aria-label="Meal selection priorities">'+
    '<span><i class="legend-dot love"></i><b>Loved</b> · 5 chances</span>'+
    '<span><i class="legend-dot like"></i><b>Liked</b> · 3 chances</span>'+
    '<span><i class="legend-dot neutral"></i><b>Neutral</b> · 1 chance</span>'+
    '</div>'+
    '<p class="plan-help">The randomiser chooses from a Sim’s <b>saved taste ratings</b>. Loved recipes are most likely, liked recipes follow, and neutral foods occasionally appear. Untested, disliked and hated recipes are excluded. If only one suitable dish exists for a meal, it repeats all week.</p>'+
    '<div class="plan-generate"><button type="button" class="btn" data-plan-action="generate"'+(!sim||!suitable.length?' disabled':'')+'>'+
    (plan?'↻ Randomise again':'✦ Create weekly menu')+'</button>'+
    (sim?'<span class="plan-count">'+counts[5]+' loved · '+counts[4]+' liked · '+counts[3]+' neutral recipes</span>':'')+
    '</div>';

  if(!sim)return output+'<div class="empty plan-empty"><strong>No Sims yet</strong>Create a Sim under My Sims to begin planning meals.</div></div>';
  if(!suitable.length)return output+'<div class="empty plan-empty"><strong>No saved recipe opinions yet</strong>Use Taste test to discover recipes this Sim loves, likes or feels neutral about.</div></div>';
  if(!plan)return output+'<div class="empty plan-empty"><strong>Ready to plan '+api.esc(sim.name)+'’s week?</strong>Choose Create weekly menu to fill the table.</div></div>';

  if(selected)output+='<p class="plan-selected" role="status">Meal selected. Click another slot, even on a different day or meal, to swap or move it. Click this slot again to cancel.</p>';
  output+='</div><div class="plan-table-scroll" role="region" tabindex="0" aria-label="Weekly meal timetable, scroll horizontally for more days">'+
    '<table class="plan-table"><thead><tr><th scope="col" class="plan-corner">MEAL <span>✿</span></th>';
  for(let d=0;d<7;d++){
    const day=new Date(start.getFullYear(),start.getMonth(),start.getDate()+d);
    output+='<th scope="col"><span class="day-name">'+days[d]+'</span><span class="day-date">'+api.esc(dateFormat.format(day))+'</span></th>';
  }
  output+='</tr></thead><tbody>';

  for(const [mealKey,mealName] of meals){
    output+='<tr><th scope="row" class="plan-row-label"><span class="meal-symbol" aria-hidden="true">'+
      ({breakfast:'☀',lunch:'◒',dinner:'✦',snack:'✿',dessert:'♡',drinks:'♧'}[mealKey])+
      '</span><span>'+api.esc(mealName)+'</span></th>';
    for(let d=0;d<7;d++){
      const slot=d+':'+mealKey,id=plan.slots?.[slot]||'';
      const r=byId.get(id),stillExists=id?api.getState().recipes.some(x=>x.id===id):false;
      let content;
      if(r){
        const score=Number(sim.ratings[r.id]?.score);
        const ratingName=score===5?'Loved':score===4?'Liked':'Neutral';
        const status=score===5?'love':score===4?'like':'neutral';
        const favourite=api.isFavouriteRecipe(sim,r);
        content='<span class="plan-dish">'+api.esc(r.name)+'</span>'+
          '<span class="plan-rating '+status+'">'+(favourite?'★ ':'')+ratingName+'</span>';
      }else if(id){
        content='<span class="plan-no-food">'+
          (stillExists?'Opinion changed':'Recipe unavailable')+
          '<small>Randomise again</small></span>';
      }else{
        content='<span class="plan-no-food">Not yet planned</span>';
      }
      const isSelected=selected===slot;
      output+='<td><button type="button" class="plan-slot'+(isSelected?' selected':'')+
        '" data-plan-slot="'+api.esc(slot)+'" '+(r?'draggable="true"':'')+
        ' aria-pressed="'+isSelected+'" aria-label="'+api.esc(days[d]+', '+mealName+': '+(r?r.name:'empty'))+
        '" title="Drag to move or swap, or click this meal then its destination">'+content+'</button></td>';
    }
    output+='</tr>';
  }
  output+='</tbody></table></div>'+
    '<p class="plan-footer"><span aria-hidden="true">↔</span> Scroll sideways to see every day on smaller screens. Drag meals between cells to move or swap them; on touchscreens or with a keyboard, select one meal and then its destination. Your changes save automatically, and Randomise again replaces this week’s plan.</p>';
  return output;
}
document.addEventListener('click',e=>{
  const slot=e.target.closest?.('[data-plan-slot]');
  if(slot){selectSlot(slot.dataset.planSlot);return}
  const button=e.target.closest?.('[data-plan-action]');
  if(!button)return;
  switch(button.dataset.planAction){
    case 'generate':generate();break;
    case 'previous':changeWeek(-1);break;
    case 'next':changeWeek(1);break;
  }
});
document.addEventListener('change',e=>{
  if(e.target.id!=='plan-sim')return;
  simId=e.target.value;
  selected='';
  api.render();
});
document.addEventListener('dragstart',e=>{
  const slot=e.target.closest?.('[data-plan-slot]');
  if(!slot)return;
  const sim=currentSim(),plan=currentPlan();
  if(!sim||!plan||!new Set(candidates(sim).map(r=>r.id)).has(plan.slots[slot.dataset.planSlot])){
    e.preventDefault();return;
  }
  drag={slot:slot.dataset.planSlot,simId:sim.id,week:currentWeek()};
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',drag.slot);
  slot.classList.add('dragging');
});
document.addEventListener('dragover',e=>{
  const slot=e.target.closest?.('[data-plan-slot]');
  if(!slot||!drag)return;
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  slot.classList.add('drag-over');
});
document.addEventListener('dragleave',e=>{
  const slot=e.target.closest?.('[data-plan-slot]');
  if(slot&&!slot.contains(e.relatedTarget))slot.classList.remove('drag-over');
});
document.addEventListener('drop',e=>{
  const target=e.target.closest?.('[data-plan-slot]');
  if(!target||!drag)return;
  e.preventDefault();
  const from=drag;drag=null;
  if(currentSim()?.id!==from.simId||currentWeek()!==from.week)return;
  selected='';
  move(from.slot,target.dataset.planSlot);
});
document.addEventListener('dragend',()=>{
  drag=null;
  document.querySelectorAll('.plan-slot.dragging,.plan-slot.drag-over').forEach(el=>el.classList.remove('dragging','drag-over'));
});
window.PalateMealPlanner={render,generate,move,createPlanSlots:makeSlots,recipeMeal};
})();