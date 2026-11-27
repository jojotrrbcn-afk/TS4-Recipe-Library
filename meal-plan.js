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
  return api.getState().recipes.filter(recipe=>Number(sim.ratings[recipe.id]?.score)>=4&&recipeMeal(recipe));
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
  const liked=candidates(sim),groups={};
  for(const [key] of meals){
    groups[key]={pool:liked.filter(r=>recipeMeal(r)===key).map(r=>r.id),bag:[],last:''};
  }
  const slots={};
  for(let d=0;d<7;d++){
    for(const [key] of meals){
      const group=groups[key],slot=d+':'+key;
      if(!group.pool.length){slots[slot]='';continue}
      if(!group.bag.length){
        group.bag=shuffled(group.pool);
        if(group.bag.length>1&&group.bag[0]===group.last){
          const alt=group.bag.findIndex(id=>id!==group.last);
          [group.bag[0],group.bag[alt]]=[group.bag[alt],group.bag[0]];
        }
      }
      // Favor a new choice in this slot when a second valid recipe exists.
      const pos=group.bag.length>1?group.bag.findIndex(id=>id!==previous[slot]):-1;
      const recipeId=group.bag.splice(pos<0?0:pos,1)[0];
      slots[slot]=recipeId;
      group.last=recipeId;
    }
  }
  return slots;
}
function generate(){
  const sim=currentSim();
  if(!sim)return;
  if(!candidates(sim).length){
    api.toast('Taste-test recipes first. Meal plans use saved Likes and Loves.');
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
  const f=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'});
  const label=f.format(start)+' – '+f.format(end);
  const plan=currentPlan(),liked=sim?candidates(sim):[];
  const byId=new Map(liked.map(r=>[r.id,r]));
  let output=api.section('Weekly meal plan','A personalised Monday-to-Sunday menu chosen from recipes this Sim likes or loves.')+
    '<div class="card"><div class="plan-controls"><div class="field"><label for="plan-sim">Choose a Sim</label><select id="plan-sim">'+
    api.opts(api.getState().sims,sim?.id||'','Choose a Sim')+'</select></div>'+
    '<div class="plan-week"><button type="button" class="btn ghost small" data-plan-action="previous" aria-label="Previous week">←</button>'+
    '<strong>Week of '+api.esc(label)+'</strong>'+
    '<button type="button" class="btn ghost small" data-plan-action="next" aria-label="Next week">→</button></div></div>'+
    '<p class="plan-help">Only saved opinions of <b>Likes it (4/5)</b> or <b>Loves it (5/5)</b> qualify. One liked lunch means that lunch every day. Untasted, neutral and disliked foods are never added just to fill an empty slot.</p>'+
    '<div class="plan-generate"><button type="button" class="btn" data-plan-action="generate"'+(!sim||!liked.length?' disabled':'')+'>'+
    (plan?'↻ Randomise again':'✦ Generate weekly plan')+'</button>'+
    (sim?'<span class="hint">'+liked.length+' liked or loved '+(liked.length===1?'recipe':'recipes')+' available</span>':'')+
    '</div>';
  if(!sim)return output+'<div class="empty"><strong>No Sims yet</strong>Create a Sim under My Sims to begin.</div></div>';
  if(!liked.length)return output+'<div class="empty"><strong>No liked recipes yet</strong>Use Taste test to rate some dishes. You can generate the week once this Sim likes or loves a recipe.</div></div>';
  if(!plan)return output+'<div class="empty"><strong>Ready for a weekly menu?</strong>Generate a seven-day plan for '+api.esc(sim.name)+'.</div></div>';
  if(selected)output+='<p class="plan-selected" role="status">Meal selected. Choose any other slot, including a different meal category or day, to swap or move it. Select the same slot to cancel.</p>';
  output+='</div><div class="plan-days">';
  for(let d=0;d<7;d++){
    const day=new Date(start.getFullYear(),start.getMonth(),start.getDate()+d);
    output+='<section class="plan-day"><h3>'+days[d]+' <small>'+api.esc(f.format(day))+'</small></h3>';
    for(const [key,mealName] of meals){
      const slot=d+':'+key,id=plan.slots?.[slot]||'';
      const r=byId.get(id);
      const old=id?api.getState().recipes.find(x=>x.id===id):null;
      let content;
      if(r){
        const score=Number(sim.ratings[r.id]?.score),fav=api.isFavouriteRecipe(sim,r);
        const creator=r.kitchenCreator||'';
        content='<b>'+api.esc(r.name)+'</b><small>'+api.esc(creator)+
          (creator?' · ':'')+api.esc(['','Hates it','Dislikes it','Neutral','Likes it','Loves it'][score])+
          (fav?' · ★ Favourite':'')+'</small>';
      }else if(old){
        content='<span class="plan-no-food">No longer liked. Randomise again.</span>';
      }else if(id){
        content='<span class="plan-no-food">Recipe unavailable. Randomise again.</span>';
      }else{
        content='<span class="plan-no-food">No liked recipe yet</span>';
      }
      const isSelected=selected===slot;
      output+='<button type="button" class="plan-slot'+(isSelected?' selected':'')+
        '" data-plan-slot="'+api.esc(slot)+'" '+(r?'draggable="true"':'')+
        ' aria-pressed="'+isSelected+'" title="Drag to move or swap, or select this meal and a destination">'+
        '<span class="plan-label">'+api.esc(mealName)+'</span><span class="plan-meal">'+content+'</span></button>';
    }
    output+='</section>';
  }
  return output+'</div><p class="plan-footer">Drag a meal onto any other slot to swap them. Dropping into an empty slot moves it there. On touch screens, tap the meal and then its destination instead. The saved plan stays unchanged until you rearrange it or click Randomise again. Each Sim and week has its own saved menu.</p>';
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