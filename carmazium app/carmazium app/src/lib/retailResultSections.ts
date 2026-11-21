export function retailResultSections<T extends {id:string}>(regular:T[],featured:T[],state:{page:number;filterCount:number;query:string;sortId:string;quickFilter:string;loading:boolean;error:boolean}) {
  const show=!state.loading&&!state.error&&state.page===1&&state.filterCount===0&&!state.query.trim()&&state.sortId==='newest'&&state.quickFilter==='all';
  const pinned=show?featured.filter((item,index,items)=>items.findIndex(candidate=>candidate.id===item.id)===index):[];
  const ids=new Set(pinned.map(item=>item.id));
  return {featured:pinned,regular:regular.filter(item=>!ids.has(item.id))};
}
