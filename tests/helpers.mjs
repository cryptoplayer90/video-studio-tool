export const flush = async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
export const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
export class FakeClock {
  constructor(time=0){this.time=time;this.next=0;this.timers=new Map();}
  now=()=>this.time;
  setTimeout=(fn,delay)=>{const id=++this.next;this.timers.set(id,{at:this.time+Math.max(0,delay),fn});return id;};
  clearTimeout=id=>this.timers.delete(id);
  async advance(ms){
    const target=this.time+ms;let count=0;
    await flush();
    while(true){
      const entry=[...this.timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at || a[0]-b[0])[0];
      if(!entry)break;
      if(++count>100000)throw new Error('Fake clock timer spin');
      this.time=Math.max(this.time,entry[1].at);this.timers.delete(entry[0]);entry[1].fn();await flush();
    }
    this.time=target;await flush();
  }
}
